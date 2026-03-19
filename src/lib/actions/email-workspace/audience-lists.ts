"use server";

import { Prisma } from "@prisma/client";
import type {
  AudienceQueryType as PrismaAudienceQueryType,
  EmailContentScope as PrismaEmailContentScope,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import {
  hasPermission,
  isAdmin,
  type PermissionAction,
} from "@/lib/rbac/permissions";
import {
  DEFAULT_ALLOWED_AUDIENCE_SOURCES,
  validateAudienceSql,
} from "@/lib/email-workspace/sql-guard";
import {
  isFolderSchemaMissingError,
  validateFolderAssignment,
} from "@/lib/email-workspace/folder-access";

type AudienceListCreateData = Parameters<
  typeof prisma.audienceList.create
>[0]["data"];
type AudienceListUpdateData = Parameters<
  typeof prisma.audienceList.update
>[0]["data"];
type AudienceListWhereInput = Exclude<
  NonNullable<Parameters<typeof prisma.audienceList.findMany>[0]>["where"],
  undefined
>;
type UserWhereInput = Exclude<
  NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"],
  undefined
>;

type AudienceQueryType = PrismaAudienceQueryType;
type EmailContentScope = PrismaEmailContentScope;

type SqlResultRow = Record<string, unknown>;
type AudienceFilterActiveStatus = "ACTIVE" | "INACTIVE" | "ANY";

type AudienceFilterPayload = {
  roleNames: string[];
  activeStatus: AudienceFilterActiveStatus;
  venueIds: string[];
  search: string | null;
  limit: number;
  aiPrompt: string | null;
};

export interface AudienceListSummary {
  id: string;
  folderId: string | null;
  name: string;
  description: string | null;
  queryType: AudienceQueryType;
  scope: EmailContentScope;
  venueId: string | null;
  ownerId: string;
  lastRunAt: Date | null;
  lastCount: number;
  createdAt: Date;
  updatedAt: Date;
  runCount: number;
}

export interface AudienceRunSummary {
  id: string;
  audienceListId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date | null;
  completedAt: Date | null;
  rowCount: number;
  error: string | null;
  createdAt: Date;
}

export interface ListAudienceListsInput {
  search?: string;
  folderId?: string;
  queryType?: AudienceQueryType | "ALL";
  take?: number;
}

export interface CreateAudienceListInput {
  name: string;
  description?: string;
  queryType: AudienceQueryType;
  sqlText?: string;
  filterJson?: Record<string, unknown>;
  folderId?: string | null;
  scope?: EmailContentScope;
  venueId?: string | null;
}

export interface UpdateAudienceListInput {
  id: string;
  name?: string;
  description?: string;
  folderId?: string | null;
  queryType?: AudienceQueryType;
  sqlText?: string;
  filterJson?: Record<string, unknown>;
  scope?: EmailContentScope;
  venueId?: string | null;
}

export interface DeleteAudienceListInput {
  id: string;
}

export interface RunAudienceListInput {
  id: string;
}

export interface AudienceListsOutput {
  success: boolean;
  lists?: AudienceListSummary[];
  error?: string;
}

export interface AudienceListMutationOutput {
  success: boolean;
  list?: AudienceListSummary;
  error?: string;
}

export interface AudienceListDeleteOutput {
  success: boolean;
  error?: string;
}

export interface RunAudienceListOutput {
  success: boolean;
  run?: AudienceRunSummary;
  error?: string;
}

function isAudienceSchemaMissingError(error: unknown): boolean {
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
        if (
          message.includes("audience_lists") ||
          message.includes("audience_runs") ||
          message.includes("audience_member_snapshots")
        ) {
          return true;
        }
      }
    }
  }

  const message = String(error).toLowerCase();
  return (
    message.includes("audience_lists") ||
    message.includes("audience_runs") ||
    message.includes("audience_member_snapshots")
  );
}

function getSchemaMissingMessage() {
  return "Audience list features are not available yet. Run the pending Prisma migration first.";
}

function revalidateAudiencePaths() {
  const paths = [
    "/emails/audience",
    "/emails/campaigns",
    "/system/emails",
    "/manage/emails",
  ];
  for (const path of paths) {
    revalidatePath(path);
  }
}

const MAX_AUDIENCE_SQL_ROWS = 2000;
const SQL_STATEMENT_TIMEOUT_MS = 5000;

async function getUserVenueIds(userId: string): Promise<string[]> {
  const rows = await prisma.userVenue.findMany({
    where: { userId },
    select: { venueId: true },
  });
  return rows.map((row) => row.venueId);
}

async function canMutateAudienceLists(
  userId: string,
  action: Extract<PermissionAction, "create" | "update" | "delete">
): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  if (await hasPermission(userId, "email_workspace", "manage")) {
    return true;
  }

  if (await hasPermission(userId, "email_audience", "manage")) {
    return true;
  }

  return hasPermission(userId, "email_audience", action);
}

function canReadAudienceList(
  list: {
    scope: EmailContentScope;
    ownerId: string;
    venueId: string | null;
  },
  userId: string,
  isAdminUser: boolean,
  userVenueIds: string[]
): boolean {
  if (isAdminUser) {
    return true;
  }

  if (list.scope === "SYSTEM") {
    return true;
  }

  if (list.ownerId === userId) {
    return true;
  }

  if (
    list.scope === "TEAM" &&
    list.venueId &&
    userVenueIds.includes(list.venueId)
  ) {
    return true;
  }

  return false;
}

function toAudienceListSummary(list: {
  id: string;
  folderId: string | null;
  name: string;
  description: string | null;
  queryType: AudienceQueryType;
  scope: EmailContentScope;
  venueId: string | null;
  ownerId: string;
  lastRunAt: Date | null;
  lastCount: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { runs: number };
}): AudienceListSummary {
  return {
    id: list.id,
    folderId: list.folderId,
    name: list.name,
    description: list.description,
    queryType: list.queryType,
    scope: list.scope,
    venueId: list.venueId,
    ownerId: list.ownerId,
    lastRunAt: list.lastRunAt,
    lastCount: list.lastCount,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    runCount: list._count?.runs ?? 0,
  };
}

function toAudienceRunSummary(run: {
  id: string;
  audienceListId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date | null;
  completedAt: Date | null;
  rowCount: number;
  error: string | null;
  createdAt: Date;
}): AudienceRunSummary {
  return {
    id: run.id,
    audienceListId: run.audienceListId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    rowCount: run.rowCount,
    error: run.error,
    createdAt: run.createdAt,
  };
}

function buildVisibilityWhere(
  userId: string,
  isAdminUser: boolean,
  userVenueIds: string[]
): AudienceListWhereInput {
  if (isAdminUser) {
    return {};
  }

  return {
    OR: [
      { scope: "SYSTEM" },
      { ownerId: userId },
      { scope: "TEAM", venueId: { in: userVenueIds } },
    ],
  };
}

function stripTrailingSemicolon(sql: string): string {
  return sql.replace(/;\s*$/, "").trim();
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = String(error).replace(/\s+/g, " ").trim();
  return raw.length > 300 ? `${raw.slice(0, 300)}...` : raw;
}

function getCaseInsensitive(
  row: SqlResultRow,
  candidateKeys: string[]
): unknown {
  for (const [key, value] of Object.entries(row)) {
    if (candidateKeys.includes(key.toLowerCase())) {
      return value;
    }
  }

  return undefined;
}

function extractEmail(row: SqlResultRow): string | null {
  const value = getCaseInsensitive(row, [
    "email",
    "user_email",
    "recipient_email",
  ]);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractUserId(row: SqlResultRow): string | null {
  const preferred = getCaseInsensitive(row, ["user_id", "userid", "userid"]);
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }

  const fallback = getCaseInsensitive(row, ["id"]);
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  return null;
}

function toSnapshotMetadata(row: SqlResultRow): Prisma.InputJsonValue | null {
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const lowered = key.toLowerCase();
    if (
      lowered === "email" ||
      lowered === "user_email" ||
      lowered === "recipient_email" ||
      lowered === "user_id" ||
      lowered === "userid" ||
      lowered === "id"
    ) {
      continue;
    }

    metadata[key] = value;
  }

  return Object.keys(metadata).length > 0
    ? (metadata as Prisma.InputJsonValue)
    : null;
}

async function executeAudienceSql(
  normalizedSql: string
): Promise<{
  rowCount: number;
  snapshots: Array<{
    userId: string | null;
    email: string;
    metadataJson: Prisma.InputJsonValue | null;
  }>;
}> {
  const sql = stripTrailingSemicolon(normalizedSql);
  const wrappedSql = `SELECT * FROM (${sql}) AS audience_source LIMIT ${MAX_AUDIENCE_SQL_ROWS}`;

  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL statement_timeout = '${SQL_STATEMENT_TIMEOUT_MS}ms'`
    );
    return tx.$queryRawUnsafe<SqlResultRow[]>(wrappedSql);
  });

  const snapshots = rows
    .map((row) => {
      const email = extractEmail(row);
      if (!email) {
        return null;
      }

      return {
        userId: extractUserId(row),
        email,
        metadataJson: toSnapshotMetadata(row),
      };
    })
    .filter(
      (
        value
      ): value is {
        userId: string | null;
        email: string;
        metadataJson: Prisma.InputJsonValue | null;
      } => Boolean(value)
    );

  return {
    rowCount: snapshots.length,
    snapshots,
  };
}

function clampLimit(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(Math.floor(value), MAX_AUDIENCE_SQL_ROWS));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(parsed, MAX_AUDIENCE_SQL_ROWS));
    }
  }

  return fallback;
}

function normalizeRoleNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set(["ADMIN", "MANAGER", "STAFF"]);
  const roles = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0 && allowed.has(item));

  return Array.from(new Set(roles));
}

function normalizeVenueIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const venueIds = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(venueIds));
}

function parseActiveStatus(value: unknown): AudienceFilterActiveStatus {
  if (typeof value !== "string") {
    return "ANY";
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === "ACTIVE" ||
    normalized === "INACTIVE" ||
    normalized === "ANY"
  ) {
    return normalized;
  }

  return "ANY";
}

function readFilterSource(filterJson: unknown): Record<string, unknown> {
  if (
    !filterJson ||
    typeof filterJson !== "object" ||
    Array.isArray(filterJson)
  ) {
    return {};
  }

  const base = filterJson as Record<string, unknown>;
  if (
    base.filters &&
    typeof base.filters === "object" &&
    !Array.isArray(base.filters)
  ) {
    return base.filters as Record<string, unknown>;
  }

  return base;
}

function parseAudienceFilterPayload(
  filterJson: unknown
): AudienceFilterPayload {
  const base =
    filterJson && typeof filterJson === "object" && !Array.isArray(filterJson)
      ? (filterJson as Record<string, unknown>)
      : {};
  const source = readFilterSource(filterJson);

  const aiPromptSource =
    typeof base.aiPrompt === "string"
      ? base.aiPrompt
      : typeof source.aiPrompt === "string"
        ? source.aiPrompt
        : null;

  const searchSource =
    typeof source.search === "string"
      ? source.search
      : typeof base.search === "string"
        ? base.search
        : null;

  return {
    roleNames: normalizeRoleNames(source.roleNames ?? source.roles),
    activeStatus: parseActiveStatus(source.activeStatus),
    venueIds: normalizeVenueIds(source.venueIds),
    search: searchSource?.trim() || null,
    limit: clampLimit(source.limit, 500),
    aiPrompt: aiPromptSource?.trim() || null,
  };
}

function deriveFilterPayloadFromPrompt(
  prompt: string
): Partial<AudienceFilterPayload> {
  const normalized = prompt.toLowerCase();
  const derivedRoles = new Set<string>();

  if (normalized.includes("admin")) {
    derivedRoles.add("ADMIN");
  }
  if (normalized.includes("manager")) {
    derivedRoles.add("MANAGER");
  }
  if (normalized.includes("staff")) {
    derivedRoles.add("STAFF");
  }

  const activeStatus: AudienceFilterActiveStatus =
    normalized.includes("inactive") || normalized.includes("disabled")
      ? "INACTIVE"
      : normalized.includes("active")
        ? "ACTIVE"
        : "ANY";

  const limitMatch = normalized.match(/\b(?:limit|top|first)\s+(\d{1,4})\b/);
  const limit = limitMatch ? clampLimit(limitMatch[1], 500) : undefined;

  return {
    roleNames: Array.from(derivedRoles),
    activeStatus,
    limit,
  };
}

function mergeFilterPayload(
  configured: AudienceFilterPayload,
  derived: Partial<AudienceFilterPayload>
): AudienceFilterPayload {
  return {
    roleNames:
      configured.roleNames.length > 0
        ? configured.roleNames
        : (derived.roleNames ?? []),
    activeStatus:
      configured.activeStatus !== "ANY"
        ? configured.activeStatus
        : (derived.activeStatus ?? "ANY"),
    venueIds: configured.venueIds,
    search: configured.search,
    limit: configured.limit || derived.limit || 500,
    aiPrompt: configured.aiPrompt,
  };
}

async function executeAudienceFilter({
  userId,
  isAdminUser,
  userVenueIds,
  filter,
}: {
  userId: string;
  isAdminUser: boolean;
  userVenueIds: string[];
  filter: AudienceFilterPayload;
}): Promise<{
  rowCount: number;
  snapshots: Array<{
    userId: string | null;
    email: string;
    metadataJson: Prisma.InputJsonValue | null;
  }>;
  appliedFilter: Record<string, unknown>;
}> {
  const andWhere: UserWhereInput[] = [];

  if (filter.activeStatus === "ACTIVE") {
    andWhere.push({ active: true });
  } else if (filter.activeStatus === "INACTIVE") {
    andWhere.push({ active: false });
  }

  if (filter.roleNames.length > 0) {
    andWhere.push({
      role: {
        name: {
          in: filter.roleNames,
        },
      },
    });
  }

  if (filter.search) {
    andWhere.push({
      OR: [
        { email: { contains: filter.search, mode: "insensitive" } },
        { firstName: { contains: filter.search, mode: "insensitive" } },
        { lastName: { contains: filter.search, mode: "insensitive" } },
      ],
    });
  }

  const requestedVenueIds = filter.venueIds;
  if (requestedVenueIds.length > 0) {
    if (isAdminUser) {
      andWhere.push({
        OR: [
          { venueId: { in: requestedVenueIds } },
          { venues: { some: { venueId: { in: requestedVenueIds } } } },
        ],
      });
    } else {
      const allowedVenueIds = requestedVenueIds.filter((venueId) =>
        userVenueIds.includes(venueId)
      );
      if (allowedVenueIds.length > 0) {
        andWhere.push({
          OR: [
            { venueId: { in: allowedVenueIds } },
            { venues: { some: { venueId: { in: allowedVenueIds } } } },
          ],
        });
      } else {
        andWhere.push({
          id: "__NO_MATCH__",
        });
      }
    }
  } else if (!isAdminUser) {
    if (userVenueIds.length > 0) {
      andWhere.push({
        OR: [
          { venueId: { in: userVenueIds } },
          { venues: { some: { venueId: { in: userVenueIds } } } },
        ],
      });
    } else {
      andWhere.push({
        id: userId,
      });
    }
  }

  const where: UserWhereInput = andWhere.length > 0 ? { AND: andWhere } : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      active: true,
      role: {
        select: { name: true },
      },
      venueId: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    take: filter.limit,
  });

  const snapshots = users
    .filter((user) => Boolean(user.email?.trim()))
    .map((user) => ({
      userId: user.id,
      email: user.email.trim(),
      metadataJson: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        active: user.active,
        venueId: user.venueId,
      } as Prisma.InputJsonValue,
    }));

  return {
    rowCount: snapshots.length,
    snapshots,
    appliedFilter: {
      roleNames: filter.roleNames,
      activeStatus: filter.activeStatus,
      venueIds: requestedVenueIds,
      search: filter.search,
      limit: filter.limit,
    },
  };
}

function getResolvedScopeAndVenue(input: {
  isAdminUser: boolean;
  userVenueIds: string[];
  requestedScope: EmailContentScope;
  requestedVenueId: string | null;
}): { scope: EmailContentScope; venueId: string | null; error?: string } {
  if (input.isAdminUser) {
    return {
      scope: input.requestedScope,
      venueId: input.requestedVenueId,
    };
  }

  if (input.requestedScope === "SYSTEM") {
    return {
      scope: "PRIVATE",
      venueId: null,
      error: "Only admins can create system-scoped audience lists.",
    };
  }

  if (input.requestedScope === "TEAM") {
    const venueId = input.requestedVenueId || input.userVenueIds[0] || null;
    if (!venueId) {
      return {
        scope: "TEAM",
        venueId: null,
        error: "Select a venue for team-scoped audience lists.",
      };
    }

    if (!input.userVenueIds.includes(venueId)) {
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
    !input.userVenueIds.includes(input.requestedVenueId)
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

export async function listAudienceLists(
  input: ListAudienceListsInput = {}
): Promise<AudienceListsOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "audience"))) {
      return {
        success: false,
        error: "You don't have permission to view audience lists.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);

    const whereClauses: AudienceListWhereInput[] = [
      buildVisibilityWhere(user.id, isAdminUser, userVenueIds),
    ];

    if (input.search?.trim()) {
      const search = input.search.trim();
      whereClauses.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (input.folderId && input.folderId !== "none") {
      whereClauses.push({ folderId: input.folderId });
    }

    if (input.folderId === "none") {
      whereClauses.push({ folderId: null });
    }

    if (input.queryType && input.queryType !== "ALL") {
      whereClauses.push({ queryType: input.queryType });
    }

    const where: AudienceListWhereInput =
      whereClauses.length > 0 ? { AND: whereClauses } : {};
    const take = Math.max(1, Math.min(input.take ?? 100, 250));

    const lists = await prisma.audienceList.findMany({
      where,
      include: {
        _count: {
          select: {
            runs: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
    });

    return {
      success: true,
      lists: lists.map(toAudienceListSummary),
    };
  } catch (error) {
    console.error("Error listing audience lists:", error);

    if (isAudienceSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to load audience lists.",
    };
  }
}

export async function createAudienceList(
  input: CreateAudienceListInput
): Promise<AudienceListMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "audience"))) {
      return {
        success: false,
        error: "You don't have permission to create audience lists.",
      };
    }

    if (!(await canMutateAudienceLists(user.id, "create"))) {
      return {
        success: false,
        error: "You don't have permission to create audience lists.",
      };
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return {
        success: false,
        error: "Audience list name is required.",
      };
    }

    const queryType = input.queryType || "FILTER";
    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);

    const scopeResolution = getResolvedScopeAndVenue({
      isAdminUser,
      userVenueIds,
      requestedScope: input.scope || "PRIVATE",
      requestedVenueId: input.venueId || null,
    });

    if (scopeResolution.error) {
      return {
        success: false,
        error: scopeResolution.error,
      };
    }

    let normalizedSql: string | null = null;
    if (queryType === "SQL") {
      const sqlText = input.sqlText?.trim();
      if (!sqlText) {
        return {
          success: false,
          error: "SQL text is required for SQL audience lists.",
        };
      }

      const validation = validateAudienceSql(
        sqlText,
        DEFAULT_ALLOWED_AUDIENCE_SOURCES
      );
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(" "),
        };
      }

      normalizedSql = validation.normalizedSql;
    }

    if (queryType === "AI_FILTER") {
      const parsedFilter = parseAudienceFilterPayload(input.filterJson);
      if (!parsedFilter.aiPrompt) {
        return {
          success: false,
          error: "AI Filter mode requires a prompt.",
        };
      }
    }

    let folderIdForCreate: string | null | undefined = undefined;
    if (input.folderId) {
      try {
        const folderValidation = await validateFolderAssignment({
          userId: user.id,
          isAdminUser,
          module: "audience",
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

    const createData: Record<string, unknown> = {
      name: trimmedName,
      description: input.description?.trim() || null,
      queryType,
      sqlText: queryType === "SQL" ? normalizedSql : null,
      filterJson: input.filterJson
        ? (input.filterJson as Prisma.InputJsonValue)
        : null,
      scope: scopeResolution.scope,
      venueId: scopeResolution.venueId,
      ownerId: user.id,
    };

    if (folderIdForCreate !== undefined) {
      createData.folderId = folderIdForCreate;
    }

    let list;
    try {
      list = await prisma.audienceList.create({
        data: createData as AudienceListCreateData,
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });
    } catch (createError) {
      if (
        createData.folderId !== undefined &&
        isAudienceSchemaMissingError(createError)
      ) {
        delete createData.folderId;
        list = await prisma.audienceList.create({
          data: createData as AudienceListCreateData,
          include: {
            _count: {
              select: { runs: true },
            },
          },
        });
      } else {
        throw createError;
      }
    }

    revalidateAudiencePaths();

    return {
      success: true,
      list: toAudienceListSummary(list),
    };
  } catch (error) {
    console.error("Error creating audience list:", error);

    if (isAudienceSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to create audience list.",
    };
  }
}

export async function updateAudienceList(
  input: UpdateAudienceListInput
): Promise<AudienceListMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "audience"))) {
      return {
        success: false,
        error: "You don't have permission to update audience lists.",
      };
    }

    if (!(await canMutateAudienceLists(user.id, "update"))) {
      return {
        success: false,
        error: "You don't have permission to update audience lists.",
      };
    }

    const list = await prisma.audienceList.findUnique({
      where: { id: input.id },
    });

    if (!list) {
      return {
        success: false,
        error: "Audience list not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    const canRead = canReadAudienceList(
      list,
      user.id,
      isAdminUser,
      userVenueIds
    );
    if (!canRead) {
      return {
        success: false,
        error: "You don't have permission to update this audience list.",
      };
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return {
          success: false,
          error: "Audience list name is required.",
        };
      }
      updateData.name = trimmedName;
    }

    if (input.description !== undefined) {
      updateData.description = input.description.trim() || null;
    }

    const nextQueryType = input.queryType || list.queryType;
    if (input.queryType !== undefined) {
      updateData.queryType = input.queryType;
    }

    if (nextQueryType === "SQL" && input.sqlText !== undefined) {
      const sqlText = input.sqlText.trim();
      if (!sqlText) {
        return {
          success: false,
          error: "SQL text is required for SQL audience lists.",
        };
      }

      const validation = validateAudienceSql(
        sqlText,
        DEFAULT_ALLOWED_AUDIENCE_SOURCES
      );
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(" "),
        };
      }

      updateData.sqlText = validation.normalizedSql;
    } else if (nextQueryType !== "SQL") {
      updateData.sqlText = null;
    }

    if (input.filterJson !== undefined) {
      updateData.filterJson = input.filterJson
        ? (input.filterJson as Prisma.InputJsonValue)
        : null;
    }

    if (input.scope !== undefined || input.venueId !== undefined) {
      const scopeResolution = getResolvedScopeAndVenue({
        isAdminUser,
        userVenueIds,
        requestedScope: input.scope || list.scope,
        requestedVenueId:
          input.venueId !== undefined ? input.venueId : list.venueId,
      });

      if (scopeResolution.error) {
        return {
          success: false,
          error: scopeResolution.error,
        };
      }

      updateData.scope = scopeResolution.scope;
      updateData.venueId = scopeResolution.venueId;
    }

    if (input.folderId !== undefined) {
      if (input.folderId) {
        try {
          const folderValidation = await validateFolderAssignment({
            userId: user.id,
            isAdminUser,
            module: "audience",
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
      updated = await prisma.audienceList.update({
        where: { id: input.id },
        data: updateData as AudienceListUpdateData,
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });
    } catch (updateError) {
      if (
        updateData.folderId !== undefined &&
        isAudienceSchemaMissingError(updateError)
      ) {
        delete updateData.folderId;
        updated = await prisma.audienceList.update({
          where: { id: input.id },
          data: updateData as AudienceListUpdateData,
          include: {
            _count: {
              select: { runs: true },
            },
          },
        });
      } else {
        throw updateError;
      }
    }

    revalidateAudiencePaths();

    return {
      success: true,
      list: toAudienceListSummary(updated),
    };
  } catch (error) {
    console.error("Error updating audience list:", error);

    if (isAudienceSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to update audience list.",
    };
  }
}

export async function deleteAudienceList(
  input: DeleteAudienceListInput
): Promise<AudienceListDeleteOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "audience"))) {
      return {
        success: false,
        error: "You don't have permission to delete audience lists.",
      };
    }

    if (!(await canMutateAudienceLists(user.id, "delete"))) {
      return {
        success: false,
        error: "You don't have permission to delete audience lists.",
      };
    }

    const list = await prisma.audienceList.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        ownerId: true,
        scope: true,
      },
    });

    if (!list) {
      return {
        success: false,
        error: "Audience list not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    if (!isAdminUser && list.ownerId !== user.id && list.scope === "SYSTEM") {
      return {
        success: false,
        error: "Only admins can delete system-scoped audience lists.",
      };
    }

    await prisma.audienceList.delete({
      where: { id: input.id },
    });

    revalidateAudiencePaths();

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting audience list:", error);

    if (isAudienceSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to delete audience list.",
    };
  }
}

export async function runAudienceList(
  input: RunAudienceListInput
): Promise<RunAudienceListOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "audience"))) {
      return {
        success: false,
        error: "You don't have permission to run audience lists.",
      };
    }

    const list = await prisma.audienceList.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        queryType: true,
        sqlText: true,
        filterJson: true,
        ownerId: true,
        scope: true,
        venueId: true,
      },
    });

    if (!list) {
      return {
        success: false,
        error: "Audience list not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    if (!canReadAudienceList(list, user.id, isAdminUser, userVenueIds)) {
      return {
        success: false,
        error: "You don't have permission to run this audience list.",
      };
    }

    const runStart = new Date();
    let runStatus: "COMPLETED" | "FAILED" = "COMPLETED";
    let normalizedSql: string | null = null;
    let rowCount = 0;
    let runError: string | null = null;
    let validationLog: Prisma.InputJsonValue = {
      mode: list.queryType,
      executedBy: user.id,
      note: "Run completed",
    };
    let snapshots: Array<{
      userId: string | null;
      email: string;
      metadataJson: Prisma.InputJsonValue | null;
    }> = [];

    if (list.queryType === "SQL") {
      const sqlText = list.sqlText?.trim() || "";
      const validation = validateAudienceSql(
        sqlText,
        DEFAULT_ALLOWED_AUDIENCE_SOURCES
      );

      validationLog = {
        mode: "SQL",
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        referencedSources: validation.referencedSources,
        execution: {
          rowCap: MAX_AUDIENCE_SQL_ROWS,
          statementTimeoutMs: SQL_STATEMENT_TIMEOUT_MS,
        },
      };

      if (!validation.valid) {
        runStatus = "FAILED";
        runError = validation.errors.join(" ");
      } else {
        normalizedSql = validation.normalizedSql;
        try {
          const execution = await executeAudienceSql(validation.normalizedSql);
          rowCount = execution.rowCount;
          snapshots = execution.snapshots;
        } catch (executionError) {
          runStatus = "FAILED";
          runError = sanitizeErrorMessage(executionError);
        }
      }
    } else {
      try {
        const configuredFilter = parseAudienceFilterPayload(list.filterJson);

        let effectiveFilter = configuredFilter;
        if (list.queryType === "AI_FILTER") {
          const prompt = configuredFilter.aiPrompt || "";
          const derived = deriveFilterPayloadFromPrompt(prompt);
          effectiveFilter = mergeFilterPayload(configuredFilter, derived);

          validationLog = {
            mode: "AI_FILTER",
            prompt,
            derivedFilter: derived,
            appliedFilter: {
              roleNames: effectiveFilter.roleNames,
              activeStatus: effectiveFilter.activeStatus,
              venueIds: effectiveFilter.venueIds,
              search: effectiveFilter.search,
              limit: effectiveFilter.limit,
            },
          };
        } else {
          validationLog = {
            mode: "FILTER",
            appliedFilter: {
              roleNames: effectiveFilter.roleNames,
              activeStatus: effectiveFilter.activeStatus,
              venueIds: effectiveFilter.venueIds,
              search: effectiveFilter.search,
              limit: effectiveFilter.limit,
            },
          };
        }

        const execution = await executeAudienceFilter({
          userId: user.id,
          isAdminUser,
          userVenueIds,
          filter: effectiveFilter,
        });

        rowCount = execution.rowCount;
        snapshots = execution.snapshots;
      } catch (executionError) {
        runStatus = "FAILED";
        runError = sanitizeErrorMessage(executionError);
      }
    }

    const run = await prisma.$transaction(async (tx) => {
      const createdRun = await tx.audienceRun.create({
        data: {
          audienceListId: input.id,
          status: runStatus,
          startedAt: runStart,
          completedAt: new Date(),
          rowCount,
          sqlNormalized: normalizedSql,
          validationLog,
          error: runError,
        },
      });

      if (runStatus === "COMPLETED" && snapshots.length > 0) {
        await tx.audienceMemberSnapshot.createMany({
          data: snapshots.map((snapshot) => ({
            audienceRunId: createdRun.id,
            userId: snapshot.userId,
            email: snapshot.email,
            metadataJson: snapshot.metadataJson ?? Prisma.JsonNull,
          })),
        });
      }

      if (runStatus === "COMPLETED") {
        await tx.audienceList.update({
          where: { id: input.id },
          data: {
            lastRunAt: createdRun.createdAt,
            lastCount: rowCount,
          },
        });
      }

      return createdRun;
    });

    revalidateAudiencePaths();

    const runSummary = toAudienceRunSummary(run);
    if (runSummary.status !== "COMPLETED") {
      return {
        success: false,
        run: runSummary,
        error: runSummary.error || "Audience run failed.",
      };
    }

    return {
      success: true,
      run: runSummary,
    };
  } catch (error) {
    console.error("Error running audience list:", error);

    if (isAudienceSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to run audience list.",
    };
  }
}
