import { prisma } from "@/lib/prisma";
import {
  hasPermission,
  isAdmin,
  isManager,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/rbac/permissions";

export type EmailWorkspaceModule =
  | "create"
  | "assets"
  | "audience"
  | "campaigns"
  | "reports";

const MODULE_RESOURCE_MAP: Record<EmailWorkspaceModule, PermissionResource> = {
  create: "email_create",
  assets: "email_assets",
  audience: "email_audience",
  campaigns: "email_campaigns",
  reports: "email_reports",
};

const WORKSPACE_RESOURCE: PermissionResource = "email_workspace";

const VIEW_LIKE_ACTIONS: PermissionAction[] = [
  "view",
  "view_team",
  "view_all",
  "read",
  "create",
  "manage",
  "edit",
];

async function hasVenueScopedPermission(
  userId: string,
  resource: PermissionResource,
  actions: PermissionAction[]
): Promise<boolean> {
  const permission = await prisma.userVenuePermission.findFirst({
    where: {
      userId,
      permission: {
        resource,
        action: {
          in: actions as string[],
        },
      },
    },
    select: { id: true },
  });

  return Boolean(permission);
}

async function hasAnyPermissionForResource(
  userId: string,
  resource: PermissionResource,
  actions: PermissionAction[]
): Promise<boolean> {
  for (const action of actions) {
    if (await hasPermission(userId, resource, action)) {
      return true;
    }
  }

  return hasVenueScopedPermission(userId, resource, actions);
}

async function hasAnyVenueMembership(userId: string): Promise<boolean> {
  const count = await prisma.userVenue.count({
    where: { userId },
  });

  return count > 0;
}

async function hasLegacyModuleAccess(
  userId: string,
  module: EmailWorkspaceModule
): Promise<boolean> {
  const manager = await isManager(userId);
  const inAnyVenue = await hasAnyVenueMembership(userId);

  if (module === "create" || module === "campaigns") {
    return manager || inAnyVenue;
  }

  if (module === "assets") {
    return (
      manager ||
      (await hasAnyPermissionForResource(userId, "media", [
        "view",
        "create",
        "manage",
      ]))
    );
  }

  if (module === "audience") {
    return (
      manager ||
      (await hasAnyPermissionForResource(userId, "reports", [
        "view",
        "view_team",
        "view_all",
        "create",
      ]))
    );
  }

  return (
    manager ||
    (await hasAnyPermissionForResource(userId, "reports", [
      "view",
      "view_team",
      "view_all",
      "create",
      "export",
      "export_team",
      "export_all",
    ]))
  );
}

export async function canAccessEmailModule(
  userId: string,
  module: EmailWorkspaceModule
): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  const moduleResource = MODULE_RESOURCE_MAP[module];

  if (await hasAnyPermissionForResource(userId, WORKSPACE_RESOURCE, VIEW_LIKE_ACTIONS)) {
    return true;
  }

  if (await hasAnyPermissionForResource(userId, moduleResource, VIEW_LIKE_ACTIONS)) {
    return true;
  }

  return hasLegacyModuleAccess(userId, module);
}

export async function getAccessibleEmailModules(
  userId: string
): Promise<Record<EmailWorkspaceModule, boolean>> {
  const modules: EmailWorkspaceModule[] = [
    "create",
    "assets",
    "audience",
    "campaigns",
    "reports",
  ];

  const entries = await Promise.all(
    modules.map(async (module) => {
      const allowed = await canAccessEmailModule(userId, module);
      return [module, allowed] as const;
    })
  );

  return Object.fromEntries(entries) as Record<EmailWorkspaceModule, boolean>;
}

export async function canAccessEmailWorkspace(userId: string): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  if (await hasAnyPermissionForResource(userId, WORKSPACE_RESOURCE, VIEW_LIKE_ACTIONS)) {
    return true;
  }

  const modules = await getAccessibleEmailModules(userId);
  return Object.values(modules).some(Boolean);
}
