import { prisma } from "@/lib/prisma";
import type { EmailWorkspaceModule } from "@/lib/rbac/email-workspace";
import { hasAnyRolePermission } from "@/lib/rbac/permissions";
import type { PermissionAction, PermissionResource } from "@/lib/rbac/types";
import { getUserVenueIds } from "@/lib/utils/venue";

const MODULE_RESOURCE_MAP: Record<EmailWorkspaceModule, PermissionResource> = {
  create: "email_create",
  assets: "email_assets",
  audience: "email_audience",
  campaigns: "email_campaigns",
  reports: "email_reports",
};

const GLOBAL_SCOPE_BASE_PERMISSIONS = [
  { resource: "email_workspace", action: "manage" },
  { resource: "stores", action: "view_all" },
  { resource: "stores", action: "manage" },
  { resource: "stores", action: "update" },
  { resource: "venues", action: "view_all" },
  { resource: "venues", action: "manage" },
  { resource: "admin", action: "manage_stores" },
] as const;

const MODULE_SCOPED_ACTIONS: Record<EmailWorkspaceModule, PermissionAction[]> = {
  create: ["view", "read", "create", "update", "delete", "manage"],
  assets: ["view", "read", "create", "update", "delete", "manage"],
  audience: ["view", "read", "create", "update", "delete", "manage"],
  campaigns: [
    "view",
    "read",
    "create",
    "update",
    "delete",
    "send",
    "schedule",
    "approve",
    "cancel",
    "manage",
  ],
  reports: [
    "view",
    "read",
    "create",
    "update",
    "delete",
    "export",
    "manage",
  ],
};

const EMAIL_WORKSPACE_SCOPED_ACTIONS: PermissionAction[] = [
  "view",
  "read",
  "manage",
];
const STORE_SCOPED_ACTIONS: PermissionAction[] = ["view_all", "manage", "update"];
const VENUE_SCOPED_ACTIONS: PermissionAction[] = ["view_all", "manage"];

export async function hasGlobalEmailModuleScope(
  userId: string,
  module: EmailWorkspaceModule
): Promise<boolean> {
  const moduleResource = MODULE_RESOURCE_MAP[module];

  return hasAnyRolePermission(userId, [
    ...GLOBAL_SCOPE_BASE_PERMISSIONS,
    { resource: moduleResource, action: "manage" },
    { resource: moduleResource, action: "view_all" },
  ]);
}

export async function getScopedEmailModuleVenueIds(
  userId: string,
  module: EmailWorkspaceModule,
  primaryVenueId?: string | null
): Promise<string[]> {
  const moduleResource = MODULE_RESOURCE_MAP[module];
  const moduleScopedActions = MODULE_SCOPED_ACTIONS[module];

  const [venueMembershipIds, venuePermissionRows] = await Promise.all([
    getUserVenueIds(userId),
    prisma.userVenuePermission.findMany({
      where: {
        userId,
        OR: [
          {
            permission: {
              resource: moduleResource,
              action: { in: moduleScopedActions as string[] },
            },
          },
          {
            permission: {
              resource: "email_workspace",
              action: { in: EMAIL_WORKSPACE_SCOPED_ACTIONS as string[] },
            },
          },
          {
            permission: {
              resource: "stores",
              action: { in: STORE_SCOPED_ACTIONS as string[] },
            },
          },
          {
            permission: {
              resource: "venues",
              action: { in: VENUE_SCOPED_ACTIONS as string[] },
            },
          },
        ],
      },
      select: { venueId: true },
    }),
  ]);

  const ids = new Set([
    ...venueMembershipIds,
    ...venuePermissionRows.map((row) => row.venueId),
  ]);
  if (primaryVenueId) {
    ids.add(primaryVenueId);
  }

  return Array.from(ids);
}
