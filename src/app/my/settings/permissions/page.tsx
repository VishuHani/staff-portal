import { getCurrentUser } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PermissionsDisplayClient } from "./permissions-display-client";

export default async function PermissionsSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's role with permissions
  const userWithPermissions = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      venues: {
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              code: true,
              active: true,
            },
          },
        },
      },
      venuePermissions: {
        include: {
          permission: true,
          venue: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          grantedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          grantedAt: "desc",
        },
      },
    },
  });

  if (!userWithPermissions) {
    redirect("/login");
  }

  // Group role permissions by resource
  const rolePermissions = userWithPermissions.role.rolePermissions.map((rp) => ({
    id: rp.permission.id,
    resource: rp.permission.resource,
    action: rp.permission.action,
    description: rp.permission.description,
    source: "role" as const,
  }));

  // Group venue permissions by venue
  const venuePermissionsByVenue = userWithPermissions.venuePermissions.reduce(
    (acc, vp) => {
      const venueId = vp.venueId;
      if (!acc[venueId]) {
        acc[venueId] = {
          venue: vp.venue,
          permissions: [],
        };
      }
      acc[venueId].permissions.push({
        id: vp.permission.id,
        resource: vp.permission.resource,
        action: vp.permission.action,
        description: vp.permission.description,
        source: "venue" as const,
        grantedAt: vp.grantedAt,
        grantedBy: vp.grantedByUser
          ? `${vp.grantedByUser.firstName || ""} ${vp.grantedByUser.lastName || ""}`.trim() ||
            vp.grantedByUser.email
          : "System",
      });
      return acc;
    },
    {} as Record<string, { venue: any; permissions: any[] }>
  );

  return (
    <PermissionsDisplayClient
      user={{
        id: userWithPermissions.id,
        email: userWithPermissions.email,
        firstName: userWithPermissions.firstName,
        lastName: userWithPermissions.lastName,
        role: {
          name: userWithPermissions.role.name,
          description: userWithPermissions.role.description,
        },
      }}
      rolePermissions={rolePermissions}
      venuePermissionsByVenue={Object.values(venuePermissionsByVenue)}
      venues={userWithPermissions.venues.map((v) => ({
        id: v.venue.id,
        name: v.venue.name,
        code: v.venue.code,
        isPrimary: v.isPrimary,
      }))}
    />
  );
}
