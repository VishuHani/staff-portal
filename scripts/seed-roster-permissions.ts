import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load environment variables first
config({ path: ".env.local" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Seeding roster permissions...");

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
    console.log(`  Created/updated permission: ${perm.resource}:${perm.action}`);
  }

  // Get roles
  const adminRole = await prisma.role.findFirst({ where: { name: "ADMIN" } });
  const managerRole = await prisma.role.findFirst({ where: { name: "MANAGER" } });
  const staffRole = await prisma.role.findFirst({ where: { name: "STAFF" } });

  if (!adminRole || !managerRole || !staffRole) {
    console.error("Could not find all required roles!");
    return;
  }

  // Define role-permission mappings
  const rolePermissions = {
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
        console.log(`  Assigned ${permName} to ${roleName}`);
      }
    }
  }

  console.log("Roster permissions seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
