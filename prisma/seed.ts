import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { createUserInBothSystems } from "../src/lib/auth/admin-user";

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
    // ===== AVAILABILITY PERMISSIONS =====
    { resource: "availability", action: "view_own", description: "View own availability/schedule" },
    { resource: "availability", action: "edit_own", description: "Edit own availability/schedule" },
    { resource: "availability", action: "view_team", description: "View team availability in assigned venues" },
    { resource: "availability", action: "edit_team", description: "Edit team availability in assigned venues" },
    { resource: "availability", action: "view_all", description: "View all availability (admin)" },
    { resource: "availability", action: "edit_all", description: "Edit all availability (admin)" },

    // ===== TIME-OFF PERMISSIONS =====
    { resource: "timeoff", action: "create", description: "Create own time-off requests" },
    { resource: "timeoff", action: "view_own", description: "View own time-off requests" },
    { resource: "timeoff", action: "view_team", description: "View team time-off requests in assigned venues" },
    { resource: "timeoff", action: "approve", description: "Approve time-off requests" },
    { resource: "timeoff", action: "reject", description: "Reject time-off requests" },
    { resource: "timeoff", action: "cancel", description: "Cancel approved time-off requests" },
    { resource: "timeoff", action: "view_all", description: "View all time-off requests (admin)" },
    { resource: "timeoff", action: "edit_all", description: "Edit all time-off requests (admin)" },

    // ===== POSTS PERMISSIONS =====
    { resource: "posts", action: "create", description: "Create posts in accessible channels" },
    { resource: "posts", action: "view", description: "View posts in accessible channels" },
    { resource: "posts", action: "edit_own", description: "Edit own posts" },
    { resource: "posts", action: "delete_own", description: "Delete own posts" },
    { resource: "posts", action: "moderate", description: "Pin/delete any posts, manage content" },
    { resource: "posts", action: "edit_all", description: "Edit any posts (admin)" },
    { resource: "posts", action: "delete_all", description: "Delete any posts (admin)" },

    // ===== MESSAGES PERMISSIONS =====
    { resource: "messages", action: "send", description: "Send direct messages" },
    { resource: "messages", action: "view", description: "View own conversations" },
    { resource: "messages", action: "delete_own", description: "Delete own messages" },
    { resource: "messages", action: "view_all", description: "View all conversations (admin)" },

    // ===== CHANNELS PERMISSIONS =====
    { resource: "channels", action: "create", description: "Create new channels" },
    { resource: "channels", action: "edit", description: "Edit channel settings" },
    { resource: "channels", action: "archive", description: "Archive channels" },
    { resource: "channels", action: "delete", description: "Delete channels (no posts)" },
    { resource: "channels", action: "moderate", description: "Moderate channel content" },

    // ===== USERS PERMISSIONS =====
    { resource: "users", action: "view_team", description: "View users in assigned venues" },
    { resource: "users", action: "edit_team", description: "Edit users in assigned venues" },
    { resource: "users", action: "create", description: "Create new users" },
    { resource: "users", action: "view_all", description: "View all users (admin)" },
    { resource: "users", action: "edit_all", description: "Edit all users (admin)" },
    { resource: "users", action: "delete", description: "Deactivate users" },

    // ===== REPORTS PERMISSIONS =====
    { resource: "reports", action: "view_team", description: "View reports for assigned venues" },
    { resource: "reports", action: "export_team", description: "Export data for assigned venues" },
    { resource: "reports", action: "view_ai", description: "Access AI-powered features and analytics" },
    { resource: "reports", action: "view_all", description: "View all reports (admin)" },
    { resource: "reports", action: "export_all", description: "Export all data (admin)" },

    // ===== SCHEDULES PERMISSIONS =====
    { resource: "schedules", action: "view_own", description: "View own schedule" },
    { resource: "schedules", action: "view_team", description: "View team schedules" },
    { resource: "schedules", action: "edit_team", description: "Edit team schedules" },
    { resource: "schedules", action: "publish", description: "Publish schedules" },

    // ===== ADMIN PERMISSIONS =====
    { resource: "admin", action: "manage_users", description: "Full user management" },
    { resource: "admin", action: "manage_roles", description: "Manage roles and permissions" },
    { resource: "admin", action: "manage_stores", description: "Manage venue/store settings" },
    { resource: "admin", action: "manage_permissions", description: "Manage permission assignments" },
    { resource: "admin", action: "view_audit_logs", description: "View system audit logs" },
    { resource: "admin", action: "manage_settings", description: "Manage system settings" },
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
    // Availability
    "availability:view_own",
    "availability:edit_own",
    "availability:view_team",
    "availability:edit_team",
    // Time-off
    "timeoff:create",
    "timeoff:view_own",
    "timeoff:view_team",
    "timeoff:approve",
    // Posts
    "posts:create",
    "posts:view",
    "posts:edit_own",
    "posts:delete_own",
    "posts:moderate",
    // Messages
    "messages:send",
    "messages:view",
    // Channels
    "channels:create",
    "channels:edit",
    "channels:moderate",
    // Users
    "users:view_team",
    "users:edit_team",
    // Schedules
    "schedules:view_own",
    "schedules:view_team",
    "schedules:edit_team",
    "schedules:publish",
    // Reports
    "reports:view_team",
    "reports:export_team",
    "reports:view_ai",
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
    // Availability
    "availability:view_own",
    "availability:edit_own",
    // Time-off
    "timeoff:create",
    "timeoff:view_own",
    // Posts
    "posts:create",
    "posts:view",
    "posts:edit_own",
    "posts:delete_own",
    // Messages
    "messages:send",
    "messages:view",
    // Schedules
    "schedules:view_own",
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
  const defaultStore = await prisma.venue.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Main Store",
      code: "MAIN",
      active: true,
    },
  });

  console.log("✅ Default store created");

  // Create default channels
  console.log("Creating default channels...");
  const channels = [
    {
      name: "General Announcements",
      description: "Company-wide announcements and important updates",
      type: "ALL_STAFF",
      icon: "📢",
      color: "#3b82f6",
      archived: false,
    },
    {
      name: "Team Updates",
      description: "Updates and news from different teams",
      type: "ALL_STAFF",
      icon: "👥",
      color: "#10b981",
      archived: false,
    },
    {
      name: "Social",
      description: "Casual conversations, celebrations, and fun",
      type: "ALL_STAFF",
      icon: "🎉",
      color: "#f59e0b",
      archived: false,
    },
    {
      name: "Help & Questions",
      description: "Ask questions and get help from the team",
      type: "ALL_STAFF",
      icon: "❓",
      color: "#8b5cf6",
      archived: false,
    },
    {
      name: "Managers Only",
      description: "Private channel for management discussions",
      type: "MANAGERS",
      icon: "🔒",
      color: "#ef4444",
      archived: false,
    },
  ];

  let channelCount = 0;
  for (const channelData of channels) {
    const channel = await prisma.channel.upsert({
      where: { name: channelData.name },
      update: {},
      create: channelData,
    });
    channelCount++;
  }

  console.log(`✅ ${channelCount} default channels created`);

  // Create ChannelVenue associations (link channels to the default store)
  console.log("Creating channel-venue associations...");
  let channelVenueCount = 0;
  for (const channelData of channels) {
    const channel = await prisma.channel.findUnique({
      where: { name: channelData.name },
    });

    if (channel) {
      await prisma.channelVenue.upsert({
        where: {
          channelId_venueId: {
            channelId: channel.id,
            venueId: defaultStore.id,
          },
        },
        update: {},
        create: {
          channelId: channel.id,
          venueId: defaultStore.id,
        },
      });
      channelVenueCount++;
    }
  }
  console.log(`✅ ${channelVenueCount} channel-venue associations created`);

  // Create admin user if environment variables are provided
  // NOTE: This creates the user in BOTH Supabase Auth and Prisma database
  // This is required for login to work (dual authentication system)
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    console.log("Creating admin user in both Supabase Auth and Prisma database...");

    const existingAdmin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists in Prisma database");
      console.log("   Updating password in both systems...");

      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

      // Update in Prisma
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: {
          password: hashedPassword,
          roleId: adminRole.id,
          active: true,
        },
      });

      // Note: For existing users, you may need to manually create in Supabase Auth
      // or use the syncExistingUserToSupabase utility function
      console.log("✅ Admin user password updated in Prisma");
      console.log("⚠️  If login fails, the user may not exist in Supabase Auth");
      console.log("   You can create it manually in Supabase Dashboard → Authentication → Users");
    } else {
      // Create user in BOTH systems using the shared utility
      const result = await createUserInBothSystems({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        roleId: adminRole.id,
        active: true,
      });

      if (result.success) {
        console.log("✅ Admin user created in both Supabase Auth and Prisma");
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   User ID: ${result.userId}`);
        console.log("   You can now log in with these credentials!");
      } else {
        console.error("❌ Failed to create admin user:", result.error);
        console.log("   You may need to create the user manually");
      }
    }
  } else {
    console.log("ℹ️  No admin credentials provided (ADMIN_EMAIL and ADMIN_PASSWORD not set)");
  }

  // Summary
  console.log("\n🎉 Database seeded successfully!");
  console.log("\nSummary:");
  console.log(`- 3 Roles: Admin, Manager, Staff`);
  console.log(`- ${createdPermissions.length} Permissions`);
  console.log(`- 1 Default Store: ${defaultStore.name}`);
  console.log(`- ${channelCount} Default Channels`);
  if (ADMIN_EMAIL) {
    console.log(`- 1 Admin User: ${ADMIN_EMAIL}`);
  }
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
