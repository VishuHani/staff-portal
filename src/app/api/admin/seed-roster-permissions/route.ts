import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    // In development, allow seeding with a secret header
    const isDev = process.env.NODE_ENV === "development";
    const seedSecret = request.headers.get("x-seed-secret");

    if (isDev && seedSecret === "seed-roster-permissions-dev") {
      // Allow seeding in development with secret header
      console.log("Seeding roster permissions (dev mode with secret)");
    } else {
      // In production, require admin auth
      const user = await getCurrentUser();
      if (!user || user.role.name !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    // Define roster permissions
    const rosterPermissions = [
      { resource: "rosters", action: "view_own", description: "View own roster shifts" },
      { resource: "rosters", action: "view_team", description: "View team rosters in assigned venues" },
      { resource: "rosters", action: "view_all", description: "View all rosters (admin)" },
      { resource: "rosters", action: "create", description: "Create new rosters" },
      { resource: "rosters", action: "edit", description: "Edit rosters" },
      { resource: "rosters", action: "delete", description: "Delete rosters" },
      { resource: "rosters", action: "publish", description: "Publish rosters to staff" },
      { resource: "rosters", action: "approve", description: "Approve roster submissions" },
    ];

    // Create permissions
    const createdPermissions = [];
    for (const perm of rosterPermissions) {
      const permission = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: perm.resource,
            action: perm.action,
          },
        },
        update: { description: perm.description },
        create: perm,
      });
      createdPermissions.push(permission);
    }

    // Get roles
    const adminRole = await prisma.role.findFirst({ where: { name: "ADMIN" } });
    const managerRole = await prisma.role.findFirst({ where: { name: "MANAGER" } });
    const staffRole = await prisma.role.findFirst({ where: { name: "STAFF" } });

    if (!adminRole || !managerRole || !staffRole) {
      return NextResponse.json({ error: "Could not find all required roles" }, { status: 500 });
    }

    // Define role-permission mappings
    const rolePermissions: Record<string, string[]> = {
      ADMIN: [
        "rosters:view_own",
        "rosters:view_team",
        "rosters:view_all",
        "rosters:create",
        "rosters:edit",
        "rosters:delete",
        "rosters:publish",
        "rosters:approve",
      ],
      MANAGER: [
        "rosters:view_own",
        "rosters:view_team",
        "rosters:create",
        "rosters:edit",
        "rosters:publish",
      ],
      STAFF: [
        "rosters:view_own",
      ],
    };

    // Assign permissions to roles
    const assignments = [];
    for (const [roleName, permNames] of Object.entries(rolePermissions)) {
      const role = roleName === "ADMIN" ? adminRole : roleName === "MANAGER" ? managerRole : staffRole;

      for (const permName of permNames) {
        const [resource, action] = permName.split(":");
        const permission = createdPermissions.find(
          (p) => p.resource === resource && p.action === action
        );

        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permission.id,
            },
          });
          assignments.push(`${permName} -> ${roleName}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      permissions: createdPermissions.length,
      assignments: assignments.length,
      message: "Roster permissions seeded successfully",
    });
  } catch (error) {
    console.error("Error seeding roster permissions:", error);
    return NextResponse.json(
      { error: "Failed to seed roster permissions" },
      { status: 500 }
    );
  }
}
