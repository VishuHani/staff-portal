"use server";

import { Prisma } from "@prisma/client";
import type {
  EmailAssetKind as PrismaEmailAssetKind,
  EmailContentScope as PrismaEmailContentScope,
} from "@prisma/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import {
  getScopedEmailModuleVenueIds,
  hasGlobalEmailModuleScope,
} from "@/lib/rbac/email-module-scope";
import {
  hasPermission,
  type PermissionAction,
} from "@/lib/rbac/permissions";
import {
  buildAssetIndexTags,
  extractAssetEnrichment,
  extractFileExtension,
} from "@/lib/email-workspace/asset-enrichment";
import {
  isFolderSchemaMissingError,
  validateFolderAssignment,
} from "@/lib/email-workspace/folder-access";

type EmailAssetKind = PrismaEmailAssetKind;
type EmailContentScope = PrismaEmailContentScope;

type EmailAssetCreateData = Parameters<
  typeof prisma.emailAsset.create
>[0]["data"];
type EmailAssetUpdateData = Parameters<
  typeof prisma.emailAsset.update
>[0]["data"];
type EmailAssetWhereInput = NonNullable<
  NonNullable<Parameters<typeof prisma.emailAsset.findMany>[0]>["where"]
>;

const EMAIL_ASSET_BUCKET = "email-assets";
const EMAIL_ASSET_UPLOAD_PREFIX = "uploaded";
const EMAIL_ASSET_MAX_FILE_SIZE = 25 * 1024 * 1024;
const EMAIL_ASSET_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "text/csv",
  "text/plain",
]);

export interface EmailAssetSummary {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  kind: EmailAssetKind;
  storageUrl: string;
  storagePath: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  altText: string | null;
  metadataJson: Prisma.JsonValue | null;
  tags: string[];
  scope: EmailContentScope;
  venueId: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListEmailAssetsInput {
  search?: string;
  folderId?: string;
  kind?: EmailAssetKind | "ALL";
  take?: number;
}

export interface CreateEmailAssetInput {
  name: string;
  mimeType: string;
  kind: EmailAssetKind;
  storageUrl: string;
  storagePath?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  thumbnailUrl?: string;
  altText?: string;
  metadataJson?: Record<string, unknown>;
  tags?: string[];
  scope?: EmailContentScope;
  venueId?: string | null;
  folderId?: string | null;
}

export interface UpdateEmailAssetInput {
  id: string;
  name?: string;
  altText?: string | null;
  tags?: string[];
  folderId?: string | null;
}

export interface DeleteEmailAssetInput {
  id: string;
}

export interface EmailAssetsOutput {
  success: boolean;
  assets?: EmailAssetSummary[];
  error?: string;
}

export interface EmailAssetMutationOutput {
  success: boolean;
  asset?: EmailAssetSummary;
  error?: string;
}

export interface EmailAssetDeleteOutput {
  success: boolean;
  error?: string;
}

function createAdminStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function ensureEmailAssetBucket() {
  const adminClient = createAdminStorageClient();
  if (!adminClient) {
    return {
      success: false as const,
      error:
        "Storage service is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const { data: buckets, error: listError } =
    await adminClient.storage.listBuckets();
  if (listError) {
    return {
      success: false as const,
      error: "Failed to verify storage buckets.",
    };
  }

  const bucketExists = buckets?.some(
    (bucket) => bucket.name === EMAIL_ASSET_BUCKET
  );
  if (bucketExists) {
    return {
      success: true as const,
      client: adminClient,
    };
  }

  const { error: createError } = await adminClient.storage.createBucket(
    EMAIL_ASSET_BUCKET,
    {
      public: true,
      fileSizeLimit: EMAIL_ASSET_MAX_FILE_SIZE,
    }
  );

  if (createError) {
    return {
      success: false as const,
      error: "Failed to create email asset storage bucket.",
    };
  }

  return {
    success: true as const,
    client: adminClient,
  };
}

function inferAssetKindFromMime(mimeType: string): EmailAssetKind {
  if (mimeType === "image/gif") {
    return "GIF";
  }

  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }

  if (mimeType.startsWith("video/")) {
    return "VIDEO";
  }

  return "FILE";
}

function isAllowedAssetMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    EMAIL_ASSET_ALLOWED_MIME_TYPES.has(mimeType)
  );
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isAssetsSchemaMissingError(error: unknown): boolean {
  if (isFolderSchemaMissingError(error)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const meta = error.meta as
        | { code?: string; message?: string }
        | undefined;
      if (meta?.code === "42P01" || meta?.code === "42703") {
        return true;
      }

      if (typeof meta?.message === "string") {
        const message = meta.message.toLowerCase();
        if (message.includes("email_assets")) {
          return true;
        }
      }
    }
  }

  const message = String(error).toLowerCase();
  return message.includes("email_assets");
}

function getSchemaMissingMessage() {
  return "Email asset features are not available yet. Run the pending Prisma migration first.";
}

function revalidateAssetPaths() {
  const paths = ["/emails/assets", "/system/emails", "/manage/emails"];
  for (const path of paths) {
    revalidatePath(path);
  }
}

async function canMutateAssets(
  userId: string,
  action: Extract<PermissionAction, "create" | "update" | "delete">
): Promise<boolean> {
  if (await hasPermission(userId, "email_workspace", "manage")) {
    return true;
  }

  if (await hasPermission(userId, "email_assets", "manage")) {
    return true;
  }

  return hasPermission(userId, "email_assets", action);
}

function canReadAsset(
  asset: {
    scope: EmailContentScope;
    ownerId: string;
    venueId: string | null;
  },
  userId: string,
  canAccessAllVenues: boolean,
  scopedVenueIds: string[]
): boolean {
  if (canAccessAllVenues) {
    return true;
  }

  if (asset.scope === "SYSTEM") {
    return true;
  }

  if (asset.ownerId === userId) {
    return true;
  }

  if (
    asset.scope === "TEAM" &&
    asset.venueId &&
    scopedVenueIds.includes(asset.venueId)
  ) {
    return true;
  }

  return false;
}

function buildVisibilityWhere(
  userId: string,
  canAccessAllVenues: boolean,
  scopedVenueIds: string[]
): EmailAssetWhereInput {
  if (canAccessAllVenues) {
    return {};
  }

  return {
    OR: [
      { scope: "SYSTEM" },
      { ownerId: userId },
      { scope: "TEAM", venueId: { in: scopedVenueIds } },
    ],
  };
}

function getResolvedScopeAndVenue(input: {
  canAccessAllVenues: boolean;
  scopedVenueIds: string[];
  requestedScope: EmailContentScope;
  requestedVenueId: string | null;
}): { scope: EmailContentScope; venueId: string | null; error?: string } {
  if (input.canAccessAllVenues) {
    return {
      scope: input.requestedScope,
      venueId: input.requestedVenueId,
    };
  }

  if (input.requestedScope === "SYSTEM") {
    return {
      scope: "PRIVATE",
      venueId: null,
      error:
        "Only users with global email asset permissions can create system-scoped assets.",
    };
  }

  if (input.requestedScope === "TEAM") {
    const venueId = input.requestedVenueId || input.scopedVenueIds[0] || null;
    if (!venueId) {
      return {
        scope: "TEAM",
        venueId: null,
        error: "Select a venue for team-scoped assets.",
      };
    }

    if (!input.scopedVenueIds.includes(venueId)) {
      return {
        scope: "TEAM",
        venueId,
        error: "You don't have permission to use the selected venue.",
      };
    }

    return {
      scope: "TEAM",
      venueId,
    };
  }

  if (
    input.requestedVenueId &&
    !input.scopedVenueIds.includes(input.requestedVenueId)
  ) {
    return {
      scope: "PRIVATE",
      venueId: null,
      error: "You don't have permission to use the selected venue.",
    };
  }

  return {
    scope: "PRIVATE",
    venueId: input.requestedVenueId || null,
  };
}

function toAssetSummary(asset: {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  kind: EmailAssetKind;
  storageUrl: string;
  storagePath: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  altText: string | null;
  metadataJson: Prisma.JsonValue | null;
  tags: string[];
  scope: EmailContentScope;
  venueId: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}): EmailAssetSummary {
  return {
    id: asset.id,
    folderId: asset.folderId,
    name: asset.name,
    mimeType: asset.mimeType,
    kind: asset.kind,
    storageUrl: asset.storageUrl,
    storagePath: asset.storagePath,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
    thumbnailUrl: asset.thumbnailUrl,
    altText: asset.altText,
    metadataJson: asset.metadataJson,
    tags: asset.tags,
    scope: asset.scope,
    venueId: asset.venueId,
    ownerId: asset.ownerId,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function inferStoragePath(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\/+/, "");
    return pathname || `external/${Date.now()}`;
  } catch {
    return `external/${Date.now()}`;
  }
}

function parseSearchComparator(
  token: string,
  prefix: "w" | "h" | "d"
): { min?: number; max?: number } | null {
  const pattern = new RegExp(`^${prefix}(>=|<=|>|<|:)(\\d+)$`, "i");
  const match = token.match(pattern);
  if (!match) {
    return null;
  }

  const operator = match[1];
  const parsedValue = Number(match[2]);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  const value = Math.floor(parsedValue);
  if (operator === ":" || operator === "=") {
    return { min: value, max: value };
  }
  if (operator === ">") {
    return { min: value + 1 };
  }
  if (operator === ">=") {
    return { min: value };
  }
  if (operator === "<") {
    return { max: Math.max(0, value - 1) };
  }
  return { max: value };
}

function parseAssetSearch(search: string): {
  text: string;
  tagTerms: string[];
  widthMin?: number;
  widthMax?: number;
  heightMin?: number;
  heightMax?: number;
  durationMin?: number;
  durationMax?: number;
} {
  const width = {
    min: undefined as number | undefined,
    max: undefined as number | undefined,
  };
  const height = {
    min: undefined as number | undefined,
    max: undefined as number | undefined,
  };
  const duration = {
    min: undefined as number | undefined,
    max: undefined as number | undefined,
  };
  const tagTerms: string[] = [];
  const textTerms: string[] = [];

  const tokens = search
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 20);

  for (const token of tokens) {
    const lower = token.toLowerCase();

    const dimension = lower.match(/^(\d{1,5})x(\d{1,5})$/);
    if (dimension) {
      const parsedWidth = Number(dimension[1]);
      const parsedHeight = Number(dimension[2]);
      if (parsedWidth > 0 && parsedHeight > 0) {
        width.min = parsedWidth;
        height.min = parsedHeight;
        tagTerms.push(`dim:${parsedWidth}x${parsedHeight}`);
        continue;
      }
    }

    const widthComparator = parseSearchComparator(lower, "w");
    if (widthComparator) {
      width.min = widthComparator.min ?? width.min;
      width.max = widthComparator.max ?? width.max;
      continue;
    }

    const heightComparator = parseSearchComparator(lower, "h");
    if (heightComparator) {
      height.min = heightComparator.min ?? height.min;
      height.max = heightComparator.max ?? height.max;
      continue;
    }

    const durationComparator = parseSearchComparator(
      lower.replace(/^duration/, "d"),
      "d"
    );
    if (durationComparator) {
      duration.min = durationComparator.min ?? duration.min;
      duration.max = durationComparator.max ?? duration.max;
      continue;
    }

    if (lower.startsWith("tag:") && lower.length > 4) {
      tagTerms.push(lower.slice(4));
      continue;
    }

    tagTerms.push(lower);
    textTerms.push(token);
  }

  return {
    text: textTerms.join(" "),
    tagTerms: [...new Set(tagTerms)].slice(0, 12),
    widthMin: width.min,
    widthMax: width.max,
    heightMin: height.min,
    heightMax: height.max,
    durationMin: duration.min,
    durationMax: duration.max,
  };
}

function extractStoragePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/${EMAIL_ASSET_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) {
      return null;
    }
    return parsed.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

export async function listEmailAssets(
  input: ListEmailAssetsInput = {}
): Promise<EmailAssetsOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "assets"))) {
      return {
        success: false,
        error: "You don't have permission to view email assets.",
      };
    }

    const canAccessAllVenues = await hasGlobalEmailModuleScope(
      user.id,
      "assets"
    );
    const scopedVenueIds = canAccessAllVenues
      ? []
      : await getScopedEmailModuleVenueIds(user.id, "assets");

    const whereClauses: EmailAssetWhereInput[] = [
      buildVisibilityWhere(user.id, canAccessAllVenues, scopedVenueIds),
    ];

    if (input.search?.trim()) {
      const search = input.search.trim();
      const parsedSearch = parseAssetSearch(search);
      const searchOr: EmailAssetWhereInput[] = [
        {
          name: { contains: parsedSearch.text || search, mode: "insensitive" },
        },
        {
          mimeType: {
            contains: parsedSearch.text || search,
            mode: "insensitive",
          },
        },
        {
          storagePath: {
            contains: parsedSearch.text || search,
            mode: "insensitive",
          },
        },
        {
          altText: {
            contains: parsedSearch.text || search,
            mode: "insensitive",
          },
        },
      ];

      if (parsedSearch.tagTerms.length > 0) {
        searchOr.push({ tags: { hasSome: parsedSearch.tagTerms } });
      }

      whereClauses.push({
        OR: searchOr,
      });

      if (parsedSearch.widthMin !== undefined) {
        whereClauses.push({
          width: { gte: parsedSearch.widthMin },
        });
      }
      if (parsedSearch.widthMax !== undefined) {
        whereClauses.push({
          width: { lte: parsedSearch.widthMax },
        });
      }

      if (parsedSearch.heightMin !== undefined) {
        whereClauses.push({
          height: { gte: parsedSearch.heightMin },
        });
      }
      if (parsedSearch.heightMax !== undefined) {
        whereClauses.push({
          height: { lte: parsedSearch.heightMax },
        });
      }

      if (parsedSearch.durationMin !== undefined) {
        whereClauses.push({
          durationSec: { gte: parsedSearch.durationMin },
        });
      }
      if (parsedSearch.durationMax !== undefined) {
        whereClauses.push({
          durationSec: { lte: parsedSearch.durationMax },
        });
      }
    }

    if (input.folderId && input.folderId !== "none") {
      whereClauses.push({ folderId: input.folderId });
    }

    if (input.folderId === "none") {
      whereClauses.push({ folderId: null });
    }

    if (input.kind && input.kind !== "ALL") {
      whereClauses.push({ kind: input.kind });
    }

    const where: EmailAssetWhereInput =
      whereClauses.length > 0 ? { AND: whereClauses } : {};
    const take = Math.max(1, Math.min(input.take ?? 100, 250));

    const assets = await prisma.emailAsset.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take,
    });

    return {
      success: true,
      assets: assets.map(toAssetSummary),
    };
  } catch (error) {
    console.error("Error listing email assets:", error);

    if (isAssetsSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to load email assets.",
    };
  }
}

export async function createEmailAsset(
  input: CreateEmailAssetInput
): Promise<EmailAssetMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "assets"))) {
      return {
        success: false,
        error: "You don't have permission to create email assets.",
      };
    }

    if (!(await canMutateAssets(user.id, "create"))) {
      return {
        success: false,
        error: "You don't have permission to create email assets.",
      };
    }

    const trimmedName = input.name.trim();
    const trimmedMimeType = input.mimeType.trim();
    const trimmedStorageUrl = input.storageUrl.trim();

    if (!trimmedName || !trimmedMimeType || !trimmedStorageUrl) {
      return {
        success: false,
        error: "Asset name, MIME type, and URL are required.",
      };
    }

    const canAccessAllVenues = await hasGlobalEmailModuleScope(
      user.id,
      "assets"
    );
    const scopedVenueIds = canAccessAllVenues
      ? []
      : await getScopedEmailModuleVenueIds(user.id, "assets");
    const scopeResolution = getResolvedScopeAndVenue({
      canAccessAllVenues,
      scopedVenueIds,
      requestedScope: input.scope || "PRIVATE",
      requestedVenueId: input.venueId || null,
    });

    if (scopeResolution.error) {
      return {
        success: false,
        error: scopeResolution.error,
      };
    }

    let folderIdForCreate: string | null | undefined = undefined;
    if (input.folderId) {
      try {
        const folderValidation = await validateFolderAssignment({
          userId: user.id,
          isAdminUser: canAccessAllVenues,
          module: "assets",
          folderId: input.folderId,
        });

        if (!folderValidation.valid) {
          return {
            success: false,
            error: folderValidation.error || "Invalid folder selection.",
          };
        }

        folderIdForCreate = input.folderId;
      } catch (folderError) {
        if (!isFolderSchemaMissingError(folderError)) {
          throw folderError;
        }
      }
    }

    const resolvedStoragePath =
      input.storagePath?.trim() || inferStoragePath(trimmedStorageUrl);
    const resolvedWidth =
      typeof input.width === "number" &&
      Number.isFinite(input.width) &&
      input.width > 0
        ? Math.floor(input.width)
        : null;
    const resolvedHeight =
      typeof input.height === "number" &&
      Number.isFinite(input.height) &&
      input.height > 0
        ? Math.floor(input.height)
        : null;
    const resolvedDuration =
      typeof input.durationSec === "number" &&
      Number.isFinite(input.durationSec) &&
      input.durationSec > 0
        ? Math.floor(input.durationSec)
        : null;

    const normalizedTags = buildAssetIndexTags({
      providedTags: input.tags || [],
      mimeType: trimmedMimeType,
      kind: input.kind,
      name: trimmedName,
      extension: extractFileExtension(trimmedName),
      storagePath: resolvedStoragePath,
      width: resolvedWidth,
      height: resolvedHeight,
      durationSec: resolvedDuration,
    });

    const createData: Record<string, unknown> = {
      name: trimmedName,
      mimeType: trimmedMimeType,
      kind: input.kind,
      storageUrl: trimmedStorageUrl,
      storagePath: resolvedStoragePath,
      sizeBytes: Math.max(0, Math.floor(input.sizeBytes || 0)),
      width: resolvedWidth,
      height: resolvedHeight,
      durationSec: resolvedDuration,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      altText: input.altText?.trim() || null,
      metadataJson: (input.metadataJson ||
        null) as Prisma.InputJsonValue | null,
      tags: normalizedTags,
      scope: scopeResolution.scope,
      venueId: scopeResolution.venueId,
      ownerId: user.id,
    };

    if (folderIdForCreate !== undefined) {
      createData.folderId = folderIdForCreate;
    }

    let asset;
    try {
      asset = await prisma.emailAsset.create({
        data: createData as EmailAssetCreateData,
      });
    } catch (createError) {
      if (isAssetsSchemaMissingError(createError)) {
        // Fallback for environments that don't yet have all new columns.
        const fallbackData: Record<string, unknown> = {
          ...createData,
        };
        delete fallbackData.folderId;
        delete fallbackData.thumbnailUrl;
        delete fallbackData.metadataJson;
        asset = await prisma.emailAsset.create({
          data: fallbackData as EmailAssetCreateData,
        });
      } else {
        throw createError;
      }
    }

    revalidateAssetPaths();

    return {
      success: true,
      asset: toAssetSummary(asset),
    };
  } catch (error) {
    console.error("Error creating email asset:", error);

    if (isAssetsSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to create email asset.",
    };
  }
}

export async function uploadEmailAsset(
  formData: FormData
): Promise<EmailAssetMutationOutput> {
  let uploadedPath: string | null = null;
  let uploadedThumbnailPath: string | null = null;
  let storageConfigured = false;

  try {
    const user = await requireAuth();
    if (!(await canAccessEmailModule(user.id, "assets"))) {
      return {
        success: false,
        error: "You don't have permission to create email assets.",
      };
    }

    if (!(await canMutateAssets(user.id, "create"))) {
      return {
        success: false,
        error: "You don't have permission to create email assets.",
      };
    }

    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return {
        success: false,
        error: "Select a file to upload.",
      };
    }

    if (fileValue.size <= 0) {
      return {
        success: false,
        error: "The selected file is empty.",
      };
    }

    if (fileValue.size > EMAIL_ASSET_MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds ${Math.floor(EMAIL_ASSET_MAX_FILE_SIZE / 1024 / 1024)}MB limit.`,
      };
    }

    const mimeType = fileValue.type?.trim() || "application/octet-stream";
    if (!isAllowedAssetMimeType(mimeType)) {
      return {
        success: false,
        error: `Unsupported file type: ${mimeType}`,
      };
    }

    const bucket = await ensureEmailAssetBucket();
    if (!bucket.success) {
      return {
        success: false,
        error: bucket.error,
      };
    }
    storageConfigured = true;

    const originalName = fileValue.name.trim() || `asset-${Date.now()}`;
    const safeOriginalName =
      sanitizeFilename(originalName) || `asset-${Date.now()}`;
    const storagePath = `${EMAIL_ASSET_UPLOAD_PREFIX}/${user.id}/${randomUUID()}-${safeOriginalName}`;
    uploadedPath = storagePath;
    const tagsValue = formData.get("tags");
    const providedTags =
      typeof tagsValue === "string"
        ? tagsValue
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : [];

    const fileBytes = await fileValue.arrayBuffer();
    const inferredKind = inferAssetKindFromMime(mimeType);
    const requestedKind = formData.get("kind");
    const kind: EmailAssetKind =
      inferredKind !== "FILE"
        ? inferredKind
        : requestedKind === "IMAGE" ||
            requestedKind === "GIF" ||
            requestedKind === "VIDEO" ||
            requestedKind === "FILE"
          ? requestedKind
          : inferredKind;

    const enrichment = await extractAssetEnrichment({
      fileName: originalName,
      mimeType,
      kind,
      bytes: new Uint8Array(fileBytes),
      tags: providedTags,
      storagePath,
    });

    const upload = await bucket.client.storage
      .from(EMAIL_ASSET_BUCKET)
      .upload(storagePath, new Uint8Array(fileBytes), {
        contentType: mimeType,
        upsert: false,
      });

    if (upload.error) {
      return {
        success: false,
        error: "Failed to upload file to storage.",
      };
    }

    const {
      data: { publicUrl },
    } = bucket.client.storage
      .from(EMAIL_ASSET_BUCKET)
      .getPublicUrl(storagePath);

    const nameValue = formData.get("name");
    const scopeValue = formData.get("scope");
    const folderValue = formData.get("folderId");
    let thumbnailUrl: string | undefined;

    if (
      enrichment.thumbnailBuffer &&
      enrichment.thumbnailExtension &&
      enrichment.thumbnailContentType
    ) {
      const thumbnailPath = `thumbnails/${user.id}/${randomUUID()}.${enrichment.thumbnailExtension}`;
      const thumbnailUpload = await bucket.client.storage
        .from(EMAIL_ASSET_BUCKET)
        .upload(thumbnailPath, enrichment.thumbnailBuffer, {
          contentType: enrichment.thumbnailContentType,
          upsert: false,
        });

      if (!thumbnailUpload.error) {
        uploadedThumbnailPath = thumbnailPath;
        const {
          data: { publicUrl: thumbnailPublicUrl },
        } = bucket.client.storage
          .from(EMAIL_ASSET_BUCKET)
          .getPublicUrl(thumbnailPath);
        thumbnailUrl = thumbnailPublicUrl;
      }
    }

    const createResult = await createEmailAsset({
      name:
        typeof nameValue === "string" && nameValue.trim()
          ? nameValue.trim()
          : fileValue.name || safeOriginalName,
      mimeType,
      kind,
      storageUrl: publicUrl,
      storagePath,
      sizeBytes: fileValue.size,
      width: enrichment.width || undefined,
      height: enrichment.height || undefined,
      durationSec: enrichment.durationSec || undefined,
      thumbnailUrl,
      metadataJson: enrichment.metadataJson,
      tags: enrichment.indexTags,
      scope:
        scopeValue === "PRIVATE" ||
        scopeValue === "TEAM" ||
        scopeValue === "SYSTEM"
          ? scopeValue
          : "PRIVATE",
      folderId:
        typeof folderValue === "string" &&
        folderValue.trim() &&
        folderValue !== "none"
          ? folderValue
          : undefined,
    });

    if (!createResult.success) {
      await bucket.client.storage
        .from(EMAIL_ASSET_BUCKET)
        .remove([storagePath]);
      if (uploadedThumbnailPath) {
        await bucket.client.storage
          .from(EMAIL_ASSET_BUCKET)
          .remove([uploadedThumbnailPath]);
      }
      return createResult;
    }

    return createResult;
  } catch (error) {
    console.error("Error uploading email asset:", error);

    if (uploadedPath && storageConfigured) {
      const adminClient = createAdminStorageClient();
      if (adminClient) {
        await adminClient.storage
          .from(EMAIL_ASSET_BUCKET)
          .remove([uploadedPath]);
        if (uploadedThumbnailPath) {
          await adminClient.storage
            .from(EMAIL_ASSET_BUCKET)
            .remove([uploadedThumbnailPath]);
        }
      }
    }

    if (isAssetsSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to upload email asset.",
    };
  }
}

export async function updateEmailAsset(
  input: UpdateEmailAssetInput
): Promise<EmailAssetMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "assets"))) {
      return {
        success: false,
        error: "You don't have permission to update email assets.",
      };
    }

    if (!(await canMutateAssets(user.id, "update"))) {
      return {
        success: false,
        error: "You don't have permission to update email assets.",
      };
    }

    const existing = await prisma.emailAsset.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      return {
        success: false,
        error: "Asset not found.",
      };
    }

    const canAccessAllVenues = await hasGlobalEmailModuleScope(
      user.id,
      "assets"
    );
    const scopedVenueIds = canAccessAllVenues
      ? []
      : await getScopedEmailModuleVenueIds(user.id, "assets");
    if (
      !canReadAsset(existing, user.id, canAccessAllVenues, scopedVenueIds)
    ) {
      return {
        success: false,
        error: "You don't have permission to update this asset.",
      };
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return {
          success: false,
          error: "Asset name is required.",
        };
      }
      updateData.name = trimmedName;
    }

    if (input.altText !== undefined) {
      updateData.altText = input.altText ? input.altText.trim() : null;
    }

    if (input.tags !== undefined) {
      updateData.tags = input.tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
    }

    if (input.folderId !== undefined) {
      if (input.folderId) {
        try {
          const folderValidation = await validateFolderAssignment({
            userId: user.id,
            isAdminUser: canAccessAllVenues,
            module: "assets",
            folderId: input.folderId,
          });

          if (!folderValidation.valid) {
            return {
              success: false,
              error: folderValidation.error || "Invalid folder selection.",
            };
          }

          updateData.folderId = input.folderId;
        } catch (folderError) {
          if (!isFolderSchemaMissingError(folderError)) {
            throw folderError;
          }
        }
      } else {
        updateData.folderId = null;
      }
    }

    let updated;
    try {
      updated = await prisma.emailAsset.update({
        where: { id: input.id },
        data: updateData as EmailAssetUpdateData,
      });
    } catch (updateError) {
      if (
        updateData.folderId !== undefined &&
        isAssetsSchemaMissingError(updateError)
      ) {
        delete updateData.folderId;
        updated = await prisma.emailAsset.update({
          where: { id: input.id },
          data: updateData as EmailAssetUpdateData,
        });
      } else {
        throw updateError;
      }
    }

    revalidateAssetPaths();

    return {
      success: true,
      asset: toAssetSummary(updated),
    };
  } catch (error) {
    console.error("Error updating email asset:", error);

    if (isAssetsSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to update email asset.",
    };
  }
}

export async function deleteEmailAsset(
  input: DeleteEmailAssetInput
): Promise<EmailAssetDeleteOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "assets"))) {
      return {
        success: false,
        error: "You don't have permission to delete email assets.",
      };
    }

    if (!(await canMutateAssets(user.id, "delete"))) {
      return {
        success: false,
        error: "You don't have permission to delete email assets.",
      };
    }

    const existing = await prisma.emailAsset.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        ownerId: true,
        scope: true,
        storagePath: true,
        thumbnailUrl: true,
      },
    });

    if (!existing) {
      return {
        success: false,
        error: "Asset not found.",
      };
    }

    const canAccessAllVenues = await hasGlobalEmailModuleScope(
      user.id,
      "assets"
    );
    if (
      !canAccessAllVenues &&
      existing.ownerId !== user.id &&
      existing.scope === "SYSTEM"
    ) {
      return {
        success: false,
        error:
          "Only users with global email asset permissions can delete system-scoped assets.",
      };
    }

    await prisma.emailAsset.delete({
      where: { id: input.id },
    });

    if (existing.storagePath.startsWith(`${EMAIL_ASSET_UPLOAD_PREFIX}/`)) {
      const adminClient = createAdminStorageClient();
      if (adminClient) {
        const removeResult = await adminClient.storage
          .from(EMAIL_ASSET_BUCKET)
          .remove([existing.storagePath]);
        if (removeResult.error) {
          console.warn(
            "Failed to remove uploaded email asset from storage:",
            removeResult.error
          );
        }
      }
    }

    if (existing.thumbnailUrl) {
      const thumbnailPath = extractStoragePathFromPublicUrl(
        existing.thumbnailUrl
      );
      if (thumbnailPath) {
        const adminClient = createAdminStorageClient();
        if (adminClient) {
          const removeThumbResult = await adminClient.storage
            .from(EMAIL_ASSET_BUCKET)
            .remove([thumbnailPath]);
          if (removeThumbResult.error) {
            console.warn(
              "Failed to remove email asset thumbnail from storage:",
              removeThumbResult.error
            );
          }
        }
      }
    }

    revalidateAssetPaths();

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting email asset:", error);

    if (isAssetsSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to delete email asset.",
    };
  }
}
