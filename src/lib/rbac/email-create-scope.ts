import { prisma } from "@/lib/prisma";
import {
  hasAnyRolePermission,
  hasPermission,
} from "@/lib/rbac/permissions";
import type { PermissionAction } from "@/lib/rbac/types";
import { getUserVenueIds } from "@/lib/utils/venue";

const EMAIL_CREATE_GLOBAL_SCOPE_PERMISSIONS = [
  { resource: "email_create", action: "manage" },
  { resource: "email_workspace", action: "manage" },
  { resource: "stores", action: "view_all" },
  { resource: "stores", action: "manage" },
  { resource: "stores", action: "update" },
  { resource: "venues", action: "view_all" },
  { resource: "venues", action: "manage" },
  { resource: "admin", action: "manage_stores" },
] as const;

const EMAIL_CREATE_SCOPED_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "update",
  "delete",
  "manage",
];

const EMAIL_WORKSPACE_SCOPED_ACTIONS: PermissionAction[] = ["view", "manage"];
const STORE_SCOPED_ACTIONS: PermissionAction[] = ["view_all", "manage", "update"];
const VENUE_SCOPED_ACTIONS: PermissionAction[] = ["view_all", "manage"];

export async function hasGlobalEmailCreateScope(userId: string): Promise<boolean> {
  return hasAnyRolePermission(userId, [...EMAIL_CREATE_GLOBAL_SCOPE_PERMISSIONS]);
}

export async function getScopedEmailCreateVenueIds(
  userId: string,
  primaryVenueId?: string | null
): Promise<string[]> {
  const [venueMembershipIds, venuePermissionRows] = await Promise.all([
    getUserVenueIds(userId),
    prisma.userVenuePermission.findMany({
      where: {
        userId,
        OR: [
          {
            permission: {
              resource: "email_create",
              action: { in: EMAIL_CREATE_SCOPED_ACTIONS as string[] },
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

  const scopedVenueIds = venuePermissionRows.map((row) => row.venueId);
  const ids = new Set([...venueMembershipIds, ...scopedVenueIds]);
  if (primaryVenueId) {
    ids.add(primaryVenueId);
  }

  return Array.from(ids);
}

export async function hasEmailCreatePermissionAtVenue(
  userId: string,
  venueId: string,
  actions: PermissionAction[]
): Promise<boolean> {
  for (const action of actions) {
    if (await hasPermission(userId, "email_create", action, venueId)) {
      return true;
    }
  }

  return false;
}
