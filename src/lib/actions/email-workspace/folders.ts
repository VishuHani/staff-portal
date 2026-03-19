"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule, type EmailWorkspaceModule } from "@/lib/rbac/email-workspace";
import { hasPermission, isAdmin, isManager, type PermissionResource } from "@/lib/rbac/permissions";

export type EmailFolderScope = "PRIVATE" | "TEAM" | "SYSTEM";

type DatabaseEmailWorkspaceModule =
  | "CREATE_EMAIL"
  | "ASSETS"
  | "AUDIENCE"
  | "CAMPAIGNS"
  | "REPORTS";

type EmailFolderRow = {
  id: string;
  module: DatabaseEmailWorkspaceModule;
  name: string;
  parent_id: string | null;
  path: string;
  scope: EmailFolderScope;
  venue_id: string | null;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
};

type FolderPathRow = {
  id: string;
  path: string;
};

type FolderSiblingExistsArgs = {
  module: DatabaseEmailWorkspaceModule;
  parentId: string | null;
  name: string;
  excludeId?: string;
};

export interface EmailFolderNode {
  id: string;
  module: EmailWorkspaceModule;
  name: string;
  parentId: string | null;
  path: string;
  scope: EmailFolderScope;
  venueId: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  children: EmailFolderNode[];
}

export interface ListFolderTreeInput {
  module: EmailWorkspaceModule;
}

export interface ListFolderTreeOutput {
  success: boolean;
  tree?: EmailFolderNode[];
  error?: string;
}

export interface CreateFolderInput {
  module: EmailWorkspaceModule;
  name: string;
  parentId?: string | null;
  scope?: EmailFolderScope;
  venueId?: string | null;
}

export interface RenameFolderInput {
  id: string;
  name: string;
}

export interface MoveFolderInput {
  id: string;
  parentId?: string | null;
}

export interface DeleteFolderInput {
  id: string;
}

export interface FolderMutationOutput {
  success: boolean;
  folder?: EmailFolderNode;
  error?: string;
}

export interface DeleteFolderOutput {
  success: boolean;
  error?: string;
}

const MODULE_TO_DB: Record<EmailWorkspaceModule, DatabaseEmailWorkspaceModule> = {
  create: "CREATE_EMAIL",
  assets: "ASSETS",
  audience: "AUDIENCE",
  campaigns: "CAMPAIGNS",
  reports: "REPORTS",
};

const DB_TO_MODULE: Record<DatabaseEmailWorkspaceModule, EmailWorkspaceModule> = {
  CREATE_EMAIL: "create",
  ASSETS: "assets",
  AUDIENCE: "audience",
  CAMPAIGNS: "campaigns",
  REPORTS: "reports",
};

const MODULE_RESOURCE_MAP: Record<EmailWorkspaceModule, PermissionResource> = {
  create: "email_create",
  assets: "email_assets",
  audience: "email_audience",
  campaigns: "email_campaigns",
  reports: "email_reports",
};

function mapRowToFolder(row: EmailFolderRow): EmailFolderNode {
  return {
    id: row.id,
    module: DB_TO_MODULE[row.module],
    name: row.name,
    parentId: row.parent_id,
    path: row.path,
    scope: row.scope,
    venueId: row.venue_id,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    children: [],
  };
}

function buildFolderTree(rows: EmailFolderRow[]): EmailFolderNode[] {
  const nodes = rows.map(mapRowToFolder);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const roots: EmailFolderNode[] = [];

  for (const node of nodes) {
    if (!node.parentId) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(node.parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
}

async function getUserVenueIds(userId: string): Promise<string[]> {
  const venues = await prisma.userVenue.findMany({
    where: { userId },
    select: { venueId: true },
  });

  return venues.map((venue) => venue.venueId);
}

async function hasFolderMutationAccess(
  userId: string,
  module: EmailWorkspaceModule,
  action: "create" | "update" | "delete"
): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  const moduleResource = MODULE_RESOURCE_MAP[module];

  if (await hasPermission(userId, "email_workspace", "manage")) {
    return true;
  }

  if (await hasPermission(userId, moduleResource, "manage")) {
    return true;
  }

  if (await hasPermission(userId, moduleResource, action)) {
    return true;
  }

  return isManager(userId);
}

function canReadFolderRow(
  folder: EmailFolderRow,
  userId: string,
  isUserAdmin: boolean,
  userVenueIds: string[]
): boolean {
  if (isUserAdmin) {
    return true;
  }

  if (folder.scope === "SYSTEM") {
    return true;
  }

  if (folder.owner_id === userId) {
    return true;
  }

  if (folder.scope === "TEAM" && folder.venue_id && userVenueIds.includes(folder.venue_id)) {
    return true;
  }

  return false;
}

function isFolderTableMissing(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const meta = error.meta as { code?: string; message?: string } | undefined;
      if (meta?.code === "42P01" || meta?.code === "42703") {
        return true;
      }

      if (typeof meta?.message === "string" && meta.message.includes("email_folders")) {
        return true;
      }
    }
  }

  const message = String(error);
  return message.includes("email_folders") && message.includes("does not exist");
}

function getTableMissingMessage() {
  return "Email folder features are not available yet. Run the pending Prisma migration first.";
}

function isDuplicateFolderNameError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (Array.isArray(target)) {
        return target.some(
          (value) =>
            typeof value === "string" &&
            value.includes("email_folders_module_parent_name_ci_key")
        );
      }

      if (typeof target === "string") {
        return target.includes("email_folders_module_parent_name_ci_key");
      }

      return true;
    }

    if (error.code === "P2010") {
      const meta = error.meta as { code?: string; message?: string } | undefined;
      if (meta?.code === "23505" && typeof meta.message === "string") {
        return meta.message.includes("email_folders_module_parent_name_ci_key");
      }
    }
  }

  const message = String(error).toLowerCase();
  return (
    message.includes("email_folders_module_parent_name_ci_key") ||
    (message.includes("duplicate key") && message.includes("email_folders"))
  );
}

async function folderSiblingNameExists({
  module,
  parentId,
  name,
  excludeId,
}: FolderSiblingExistsArgs): Promise<boolean> {
  const existing = await prisma.emailFolder.findFirst({
    where: {
      module,
      parentId,
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  return Boolean(existing);
}

function revalidateEmailWorkspacePaths() {
  const paths = [
    "/emails",
    "/emails/create",
    "/emails/assets",
    "/emails/audience",
    "/emails/campaigns",
    "/emails/reports",
    "/system/emails",
    "/manage/emails",
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

async function getFolderById(id: string): Promise<EmailFolderRow | null> {
  const rows = await prisma.$queryRaw<EmailFolderRow[]>(Prisma.sql`
    SELECT
      id,
      module::text AS module,
      name,
      "parentId" AS parent_id,
      path,
      scope::text AS scope,
      "venueId" AS venue_id,
      "ownerId" AS owner_id,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at
    FROM "email_folders"
    WHERE id = ${id}
    LIMIT 1
  `);

  return rows[0] || null;
}

export async function listFolderTree(input: ListFolderTreeInput): Promise<ListFolderTreeOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, input.module))) {
      return {
        success: false,
        error: "You don't have permission to view folders in this module.",
      };
    }

    const moduleKey = MODULE_TO_DB[input.module];
    const userIsAdmin = await isAdmin(user.id);
    const userVenueIds = userIsAdmin ? [] : await getUserVenueIds(user.id);

    const teamVenueAccessSql =
      userVenueIds.length > 0
        ? Prisma.sql` OR (scope::text = 'TEAM' AND "venueId" IN (${Prisma.join(userVenueIds)}))`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<EmailFolderRow[]>(Prisma.sql`
      SELECT
        id,
        module::text AS module,
        name,
        "parentId" AS parent_id,
        path,
        scope::text AS scope,
        "venueId" AS venue_id,
        "ownerId" AS owner_id,
        "createdAt" AS created_at,
        "updatedAt" AS updated_at
      FROM "email_folders"
      WHERE module::text = ${moduleKey}
      AND (
        ${userIsAdmin}
        OR scope::text = 'SYSTEM'
        OR "ownerId" = ${user.id}
        ${teamVenueAccessSql}
      )
      ORDER BY path ASC, name ASC
    `);

    return {
      success: true,
      tree: buildFolderTree(rows),
    };
  } catch (error) {
    console.error("Error listing email folders:", error);

    if (isFolderTableMissing(error)) {
      return {
        success: false,
        error: getTableMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to load folders.",
    };
  }
}

export async function createFolder(input: CreateFolderInput): Promise<FolderMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, input.module))) {
      return {
        success: false,
        error: "You don't have permission to create folders in this module.",
      };
    }

    if (!(await hasFolderMutationAccess(user.id, input.module, "create"))) {
      return {
        success: false,
        error: "You don't have permission to create folders in this module.",
      };
    }

    const name = input.name.trim();
    if (!name) {
      return {
        success: false,
        error: "Folder name is required.",
      };
    }

    if (name.length > 120) {
      return {
        success: false,
        error: "Folder name must be 120 characters or fewer.",
      };
    }

    const userIsAdmin = await isAdmin(user.id);
    const userVenueIds = userIsAdmin ? [] : await getUserVenueIds(user.id);
    const moduleKey = MODULE_TO_DB[input.module];

    let parent: EmailFolderRow | null = null;
    if (input.parentId) {
      parent = await getFolderById(input.parentId);

      if (!parent) {
        return {
          success: false,
          error: "Parent folder not found.",
        };
      }

      if (parent.module !== moduleKey) {
        return {
          success: false,
          error: "Parent folder must be in the same module.",
        };
      }

      if (!canReadFolderRow(parent, user.id, userIsAdmin, userVenueIds)) {
        return {
          success: false,
          error: "You don't have permission to use this parent folder.",
        };
      }
    }

    let scope: EmailFolderScope = input.scope || "PRIVATE";
    let venueId = input.venueId || null;
    let path = "/";

    if (parent) {
      scope = parent.scope;
      venueId = parent.venue_id;
      path = `${parent.path}${parent.id}/`;
    } else {
      if (scope === "SYSTEM" && !userIsAdmin) {
        return {
          success: false,
          error: "Only admins can create SYSTEM-scoped folders.",
        };
      }

      if (scope === "TEAM" && !venueId) {
        return {
          success: false,
          error: "TEAM-scoped folders require a venue.",
        };
      }

      if (scope !== "TEAM") {
        venueId = null;
      }

      if (!userIsAdmin && venueId && !userVenueIds.includes(venueId)) {
        return {
          success: false,
          error: "You can only create TEAM folders for your assigned venues.",
        };
      }
    }

    const id = randomUUID();

    if (
      await folderSiblingNameExists({
        module: moduleKey,
        parentId: parent?.id || null,
        name,
      })
    ) {
      return {
        success: false,
        error: "A folder with this name already exists in the selected location.",
      };
    }

    const rows = await prisma.$queryRaw<EmailFolderRow[]>(Prisma.sql`
      INSERT INTO "email_folders" (
        id,
        module,
        name,
        "parentId",
        path,
        scope,
        "venueId",
        "ownerId",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${moduleKey}::"EmailWorkspaceModule",
        ${name},
        ${parent?.id || null},
        ${path},
        ${scope}::"EmailContentScope",
        ${venueId},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        module::text AS module,
        name,
        "parentId" AS parent_id,
        path,
        scope::text AS scope,
        "venueId" AS venue_id,
        "ownerId" AS owner_id,
        "createdAt" AS created_at,
        "updatedAt" AS updated_at
    `);

    revalidateEmailWorkspacePaths();

    return {
      success: true,
      folder: mapRowToFolder(rows[0]),
    };
  } catch (error) {
    console.error("Error creating email folder:", error);

    if (isDuplicateFolderNameError(error)) {
      return {
        success: false,
        error: "A folder with this name already exists in the selected location.",
      };
    }

    if (isFolderTableMissing(error)) {
      return {
        success: false,
        error: getTableMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to create folder.",
    };
  }
}

export async function renameFolder(input: RenameFolderInput): Promise<FolderMutationOutput> {
  try {
    const user = await requireAuth();
    const name = input.name.trim();

    if (!name) {
      return {
        success: false,
        error: "Folder name is required.",
      };
    }

    if (name.length > 120) {
      return {
        success: false,
        error: "Folder name must be 120 characters or fewer.",
      };
    }

    const folder = await getFolderById(input.id);
    if (!folder) {
      return {
        success: false,
        error: "Folder not found.",
      };
    }

    const folderModule = DB_TO_MODULE[folder.module];

    if (!(await canAccessEmailModule(user.id, folderModule))) {
      return {
        success: false,
        error: "You don't have permission to update this folder.",
      };
    }

    if (!(await hasFolderMutationAccess(user.id, folderModule, "update"))) {
      return {
        success: false,
        error: "You don't have permission to update this folder.",
      };
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin && folder.owner_id !== user.id) {
      return {
        success: false,
        error: "Only folder owners (or admins) can rename folders.",
      };
    }

    if (
      await folderSiblingNameExists({
        module: folder.module,
        parentId: folder.parent_id,
        name,
        excludeId: folder.id,
      })
    ) {
      return {
        success: false,
        error: "A sibling folder with this name already exists.",
      };
    }

    const rows = await prisma.$queryRaw<EmailFolderRow[]>(Prisma.sql`
      UPDATE "email_folders"
      SET
        name = ${name},
        "updatedAt" = NOW()
      WHERE id = ${folder.id}
      RETURNING
        id,
        module::text AS module,
        name,
        "parentId" AS parent_id,
        path,
        scope::text AS scope,
        "venueId" AS venue_id,
        "ownerId" AS owner_id,
        "createdAt" AS created_at,
        "updatedAt" AS updated_at
    `);

    revalidateEmailWorkspacePaths();

    return {
      success: true,
      folder: mapRowToFolder(rows[0]),
    };
  } catch (error) {
    console.error("Error renaming email folder:", error);

    if (isDuplicateFolderNameError(error)) {
      return {
        success: false,
        error: "A sibling folder with this name already exists.",
      };
    }

    if (isFolderTableMissing(error)) {
      return {
        success: false,
        error: getTableMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to rename folder.",
    };
  }
}

export async function moveFolder(input: MoveFolderInput): Promise<FolderMutationOutput> {
  try {
    const user = await requireAuth();
    const folder = await getFolderById(input.id);

    if (!folder) {
      return {
        success: false,
        error: "Folder not found.",
      };
    }

    const folderModule = DB_TO_MODULE[folder.module];

    if (!(await canAccessEmailModule(user.id, folderModule))) {
      return {
        success: false,
        error: "You don't have permission to move this folder.",
      };
    }

    if (!(await hasFolderMutationAccess(user.id, folderModule, "update"))) {
      return {
        success: false,
        error: "You don't have permission to move this folder.",
      };
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin && folder.owner_id !== user.id) {
      return {
        success: false,
        error: "Only folder owners (or admins) can move folders.",
      };
    }

    const oldPathPrefix = `${folder.path}${folder.id}/`;
    let nextParent: EmailFolderRow | null = null;
    let nextPath = "/";
    let nextScope = folder.scope;
    let nextVenueId = folder.venue_id;

    if (input.parentId) {
      nextParent = await getFolderById(input.parentId);

      if (!nextParent) {
        return {
          success: false,
          error: "Target parent folder not found.",
        };
      }

      if (nextParent.module !== folder.module) {
        return {
          success: false,
          error: "Target parent must be in the same module.",
        };
      }

      if (nextParent.id === folder.id || nextParent.path.startsWith(oldPathPrefix)) {
        return {
          success: false,
          error: "Cannot move a folder into itself or its own descendants.",
        };
      }

      nextPath = `${nextParent.path}${nextParent.id}/`;
      nextScope = nextParent.scope;
      nextVenueId = nextParent.venue_id;
    }

    const newPathPrefix = `${nextPath}${folder.id}/`;

    if (
      await folderSiblingNameExists({
        module: folder.module,
        parentId: nextParent?.id || null,
        name: folder.name,
        excludeId: folder.id,
      })
    ) {
      return {
        success: false,
        error: "A sibling folder with this name already exists in the destination.",
      };
    }

    const updatedFolder = await prisma.$transaction(async (tx) => {
      const updatedRows = await tx.$queryRaw<EmailFolderRow[]>(Prisma.sql`
        UPDATE "email_folders"
        SET
          "parentId" = ${nextParent?.id || null},
          path = ${nextPath},
          scope = ${nextScope}::"EmailContentScope",
          "venueId" = ${nextVenueId},
          "updatedAt" = NOW()
        WHERE id = ${folder.id}
        RETURNING
          id,
          module::text AS module,
          name,
          "parentId" AS parent_id,
          path,
          scope::text AS scope,
          "venueId" AS venue_id,
          "ownerId" AS owner_id,
          "createdAt" AS created_at,
          "updatedAt" AS updated_at
      `);

      const descendants = await tx.$queryRaw<FolderPathRow[]>(Prisma.sql`
        SELECT id, path
        FROM "email_folders"
        WHERE path LIKE ${`${oldPathPrefix}%`}
      `);

      for (const descendant of descendants) {
        const suffix = descendant.path.slice(oldPathPrefix.length);
        const nextDescendantPath = `${newPathPrefix}${suffix}`;

        await tx.$executeRaw(Prisma.sql`
          UPDATE "email_folders"
          SET
            path = ${nextDescendantPath},
            "updatedAt" = NOW()
          WHERE id = ${descendant.id}
        `);
      }

      return updatedRows[0];
    });

    revalidateEmailWorkspacePaths();

    return {
      success: true,
      folder: mapRowToFolder(updatedFolder),
    };
  } catch (error) {
    console.error("Error moving email folder:", error);

    if (isDuplicateFolderNameError(error)) {
      return {
        success: false,
        error: "A sibling folder with this name already exists in the destination.",
      };
    }

    if (isFolderTableMissing(error)) {
      return {
        success: false,
        error: getTableMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to move folder.",
    };
  }
}

export async function deleteFolder(input: DeleteFolderInput): Promise<DeleteFolderOutput> {
  try {
    const user = await requireAuth();
    const folder = await getFolderById(input.id);

    if (!folder) {
      return {
        success: false,
        error: "Folder not found.",
      };
    }

    const folderModule = DB_TO_MODULE[folder.module];

    if (!(await canAccessEmailModule(user.id, folderModule))) {
      return {
        success: false,
        error: "You don't have permission to delete this folder.",
      };
    }

    if (!(await hasFolderMutationAccess(user.id, folderModule, "delete"))) {
      return {
        success: false,
        error: "You don't have permission to delete this folder.",
      };
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin && folder.owner_id !== user.id) {
      return {
        success: false,
        error: "Only folder owners (or admins) can delete folders.",
      };
    }

    const childCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "email_folders"
      WHERE "parentId" = ${folder.id}
    `);

    const childCount = Number(childCountRows[0]?.count || 0);
    if (childCount > 0) {
      return {
        success: false,
        error: "Folder has subfolders. Move or delete subfolders first.",
      };
    }

    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "email_folders"
      WHERE id = ${folder.id}
    `);

    revalidateEmailWorkspacePaths();

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting email folder:", error);

    if (isFolderTableMissing(error)) {
      return {
        success: false,
        error: getTableMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to delete folder.",
    };
  }
}
