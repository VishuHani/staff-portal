import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), ".env.local") });

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("🌱 Starting database seed...");

  // Create Roles
  console.log("Creating roles...");
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Administrator with full system access",
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: "MANAGER" },
    update: {},
    create: {
      name: "MANAGER",
      description: "Manager with team oversight capabilities",
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { name: "STAFF" },
    update: {},
    create: {
      name: "STAFF",
      description: "Standard staff member",
    },
  });

  console.log("✅ Roles created");

  // Create Permissions
  console.log("Creating permissions...");
  const permissions = [
    // Availability permissions
    { resource: "availability", action: "view_own", description: "View own availability" },
    { resource: "availability", action: "edit_own", description: "Edit own availability" },
    { resource: "availability", action: "view_team", description: "View team availability" },
    { resource: "availability", action: "edit_team", description: "Edit team availability" },

    // Time-off permissions
    { resource: "time_off", action: "create", description: "Create time-off requests" },
    { resource: "time_off", action: "view_own", description: "View own time-off requests" },
    { resource: "time_off", action: "view_team", description: "View team time-off requests" },
    { resource: "time_off", action: "approve", description: "Approve/reject time-off requests" },

    // Posts permissions
    { resource: "posts", action: "create", description: "Create posts" },
    { resource: "posts", action: "view", description: "View posts" },
    { resource: "posts", action: "moderate", description: "Moderate posts (pin, delete)" },

    // Messages permissions
    { resource: "messages", action: "send", description: "Send direct messages" },
    { resource: "messages", action: "view", description: "View messages" },

    // Admin permissions
    { resource: "admin", action: "manage_users", description: "Manage users" },
    { resource: "admin", action: "manage_roles", description: "Manage roles and permissions" },
    { resource: "admin", action: "view_audit_logs", description: "View audit logs" },
    { resource: "admin", action: "manage_stores", description: "Manage stores" },
  ];

  const createdPermissions = [];
  for (const perm of permissions) {
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
    createdPermissions.push(permission);
  }

  console.log(`✅ ${createdPermissions.length} permissions created`);

  // Assign permissions to roles
  console.log("Assigning permissions to roles...");

  // Admin gets all permissions
  for (const permission of createdPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Manager permissions
  const managerPermissionNames = [
    "availability:view_own",
    "availability:edit_own",
    "availability:view_team",
    "time_off:create",
    "time_off:view_own",
    "time_off:view_team",
    "time_off:approve",
    "posts:create",
    "posts:view",
    "posts:moderate",
    "messages:send",
    "messages:view",
  ];

  for (const permName of managerPermissionNames) {
    const [resource, action] = permName.split(":");
    const permission = createdPermissions.find(
      (p) => p.resource === resource && p.action === action
    );
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // Staff permissions
  const staffPermissionNames = [
    "availability:view_own",
    "availability:edit_own",
    "time_off:create",
    "time_off:view_own",
    "posts:create",
    "posts:view",
    "messages:send",
    "messages:view",
  ];

  for (const permName of staffPermissionNames) {
    const [resource, action] = permName.split(":");
    const permission = createdPermissions.find(
      (p) => p.resource === resource && p.action === action
    );
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: staffRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: staffRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log("✅ Permissions assigned to roles");

  // Create a default store
  console.log("Creating default store...");
  const defaultStore = await prisma.store.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Main Store",
      code: "MAIN",
      active: true,
    },
  });

  console.log("✅ Default store created");

  // Summary
  console.log("\n🎉 Database seeded successfully!");
  console.log("\nSummary:");
  console.log(`- 3 Roles: Admin, Manager, Staff`);
  console.log(`- ${createdPermissions.length} Permissions`);
  console.log(`- 1 Default Store: ${defaultStore.name}`);
  console.log("\n✨ Your database is ready to use!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
