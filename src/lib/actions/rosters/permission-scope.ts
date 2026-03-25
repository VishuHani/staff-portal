"use server";

import { prisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission } from "@/lib/rbac/permissions";
import type { PermissionAction } from "@/lib/rbac/types";
import { getUserVenueIds } from "@/lib/utils/venue";

const ROSTER_GLOBAL_SCOPE_PERMISSIONS = [
  { resource: "rosters", action: "view_all" },
  { resource: "stores", action: "view_all" },
  { resource: "stores", action: "manage" },
  { resource: "venues", action: "view_all" },
  { resource: "venues", action: "manage" },
  { resource: "admin", action: "manage_stores" },
] as const;

const ROSTER_SCOPED_ACTIONS: PermissionAction[] = [
  "view_own",
  "view_team",
  "view_all",
  "create",
  "edit",
  "delete",
  "publish",
  "approve",
];

const STORE_SCOPED_ACTIONS: PermissionAction[] = ["view_all", "manage", "update"];
const VENUE_SCOPED_ACTIONS: PermissionAction[] = ["view_all", "manage"];

export async function hasGlobalRosterScope(userId: string): Promise<boolean> {
  return hasAnyPermission(userId, [...ROSTER_GLOBAL_SCOPE_PERMISSIONS]);
}

export async function getScopedRosterVenueIds(userId: string): Promise<string[]> {
  const [venueMembershipIds, venuePermissionRows] = await Promise.all([
    getUserVenueIds(userId),
    prisma.userVenuePermission.findMany({
      where: {
        userId,
        OR: [
          {
            permission: {
              resource: "rosters",
              action: { in: ROSTER_SCOPED_ACTIONS as string[] },
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
  return Array.from(new Set([...venueMembershipIds, ...scopedVenueIds]));
}

export async function hasRosterVenuePermission(
  userId: string,
  venueId: string,
  actions: PermissionAction[]
): Promise<boolean> {
  for (const action of actions) {
    if (await hasPermission(userId, "rosters", action, venueId)) {
      return true;
    }
  }

  return false;
}
