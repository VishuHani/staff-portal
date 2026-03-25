import { prisma } from "@/lib/prisma";
import { hasAnyRolePermission } from "@/lib/rbac/permissions";
import { getUserVenueIds } from "@/lib/utils/venue";

const EMAIL_CAMPAIGN_GLOBAL_SCOPE_PERMISSIONS = [
  { resource: "email_campaigns", action: "manage" },
  { resource: "email_workspace", action: "manage" },
  { resource: "stores", action: "view_all" },
  { resource: "stores", action: "manage" },
  { resource: "stores", action: "update" },
  { resource: "venues", action: "view_all" },
  { resource: "venues", action: "manage" },
  { resource: "admin", action: "manage_stores" },
] as const;

export async function hasGlobalEmailCampaignScope(
  userId: string
): Promise<boolean> {
  return hasAnyRolePermission(
    userId,
    [...EMAIL_CAMPAIGN_GLOBAL_SCOPE_PERMISSIONS]
  );
}

export async function getScopedEmailCampaignVenueIds(
  userId: string
): Promise<string[]> {
  const [membershipVenues, permissionVenues] = await Promise.all([
    getUserVenueIds(userId),
    prisma.userVenuePermission.findMany({
      where: {
        userId,
        OR: [
          {
            permission: {
              resource: "email_campaigns",
              action: {
                in: [
                  "view",
                  "create",
                  "update",
                  "send",
                  "schedule",
                  "approve",
                  "cancel",
                  "delete",
                  "manage",
                ],
              },
            },
          },
          {
            permission: {
              resource: "email_workspace",
              action: { in: ["view", "manage"] },
            },
          },
          {
            permission: {
              resource: "stores",
              action: { in: ["view_all", "manage", "update"] },
            },
          },
          {
            permission: {
              resource: "venues",
              action: { in: ["view_all", "manage"] },
            },
          },
        ],
      },
      select: { venueId: true },
    }),
  ]);

  return Array.from(
    new Set([...membershipVenues, ...permissionVenues.map((row) => row.venueId)])
  );
}

export async function canAccessEmailCampaignVenue(
  userId: string,
  venueId?: string | null
): Promise<boolean> {
  if (await hasGlobalEmailCampaignScope(userId)) {
    return true;
  }

  if (!venueId) {
    return false;
  }

  const scopedVenueIds = await getScopedEmailCampaignVenueIds(userId);
  return scopedVenueIds.includes(venueId);
}
