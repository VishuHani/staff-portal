/**
 * Seed Invite Permissions
 * 
 * This script adds the necessary permissions for the invitation system
 * to the ADMIN and MANAGER roles.
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding invite permissions...\n");

  // Define invite permissions
  const invitePermissions = [
    { resource: "invites", action: "view", description: "View invitations" },
    { resource: "invites", action: "create", description: "Create and send invitations" },
    { resource: "invites", action: "cancel", description: "Cancel pending invitations" },
    { resource: "invites", action: "resend", description: "Resend invitation emails" },
    { resource: "onboarding", action: "view", description: "View onboarding documents" },
    { resource: "onboarding", action: "manage", description: "Manage onboarding documents" },
  ];

  // Create permissions
  const createdPermissions = [];
  for (const perm of invitePermissions) {
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {
        description: perm.description,
      },
      create: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
    });
    createdPermissions.push(permission);
    console.log(`  Created/updated permission: ${perm.resource}:${perm.action}`);
  }

  // Get roles
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  const managerRole = await prisma.role.findUnique({
    where: { name: "MANAGER" },
  });

  const staffRole = await prisma.role.findUnique({
    where: { name: "STAFF" },
  });

  if (!adminRole || !managerRole || !staffRole) {
    throw new Error("Required roles not found. Please run the main seed first.");
  }

  // Define role-permission mappings
  const rolePermissions = {
    ADMIN: [
      "invites:view",
      "invites:create",
      "invites:cancel",
      "invites:resend",
      "onboarding:view",
      "onboarding:manage",
    ],
    MANAGER: [
      "invites:view",
      "invites:create",
      "invites:cancel",
      "invites:resend",
      "onboarding:view",
    ],
    STAFF: [], // Staff cannot send invitations
  };

  // Assign permissions to roles
  for (const [roleName, permNames] of Object.entries(rolePermissions)) {
    const role = roleName === "ADMIN" ? adminRole : roleName === "MANAGER" ? managerRole : staffRole;

    console.log(`\nAssigning permissions to ${roleName}...`);

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
        console.log(`  Added ${permName} to ${roleName}`);
      }
    }
  }

  console.log("\n✅ Invite permissions seeded successfully!");
  console.log("\n📋 Summary:");
  console.log("  - ADMIN: Full invite and onboarding access");
  console.log("  - MANAGER: Can send/manage invitations, view onboarding");
  console.log("  - STAFF: No invite permissions");
}

main()
  .catch((e) => {
    console.error("Error seeding invite permissions:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
