import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EmailWorkspaceModule } from "@/lib/rbac/email-workspace";

type DatabaseEmailWorkspaceModule =
  | "CREATE_EMAIL"
  | "ASSETS"
  | "AUDIENCE"
  | "CAMPAIGNS"
  | "REPORTS";

type FolderAccessRow = {
  id: string;
  module: DatabaseEmailWorkspaceModule;
  scope: "PRIVATE" | "TEAM" | "SYSTEM";
  venue_id: string | null;
  owner_id: string;
};

const MODULE_TO_DB: Record<EmailWorkspaceModule, DatabaseEmailWorkspaceModule> = {
  create: "CREATE_EMAIL",
  assets: "ASSETS",
  audience: "AUDIENCE",
  campaigns: "CAMPAIGNS",
  reports: "REPORTS",
};

async function getUserVenueIds(userId: string): Promise<string[]> {
  const venues = await prisma.userVenue.findMany({
    where: { userId },
    select: { venueId: true },
  });

  return venues.map((venue) => venue.venueId);
}

export interface ValidateFolderAssignmentInput {
  userId: string;
  isAdminUser: boolean;
  module: EmailWorkspaceModule;
  folderId: string;
}

export interface ValidateFolderAssignmentResult {
  valid: boolean;
  error?: string;
}

export async function validateFolderAssignment(
  input: ValidateFolderAssignmentInput
): Promise<ValidateFolderAssignmentResult> {
  const row = await prisma.$queryRaw<FolderAccessRow[]>(Prisma.sql`
    SELECT
      id,
      module::text AS module,
      scope::text AS scope,
      "venueId" AS venue_id,
      "ownerId" AS owner_id
    FROM "email_folders"
    WHERE id = ${input.folderId}
    LIMIT 1
  `);

  const folder = row[0];
  if (!folder) {
    return {
      valid: false,
      error: "Selected folder was not found.",
    };
  }

  if (folder.module !== MODULE_TO_DB[input.module]) {
    return {
      valid: false,
      error: "Selected folder is not valid for this module.",
    };
  }

  if (input.isAdminUser) {
    return { valid: true };
  }

  if (folder.scope === "SYSTEM" || folder.owner_id === input.userId) {
    return { valid: true };
  }

  if (folder.scope === "TEAM" && folder.venue_id) {
    const userVenueIds = await getUserVenueIds(input.userId);
    if (userVenueIds.includes(folder.venue_id)) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: "You don't have permission to use the selected folder.",
  };
}

export function isFolderSchemaMissingError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const meta = error.meta as { code?: string; message?: string } | undefined;
      if (meta?.code === "42P01" || meta?.code === "42703") {
        return true;
      }

      if (typeof meta?.message === "string") {
        const message = meta.message.toLowerCase();
        if (message.includes("email_folders") || message.includes("folder_id")) {
          return true;
        }
      }
    }
  }

  const message = String(error).toLowerCase();
  return message.includes("email_folders") || message.includes("folder_id");
}
