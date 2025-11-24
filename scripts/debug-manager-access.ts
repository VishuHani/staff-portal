import { prisma } from "../src/lib/prisma";

/**
 * Debug Manager Access Issue
 *
 * This script investigates why the manager cannot access User Management
 * despite having the correct permissions in the database.
 */

async function debugManagerAccess() {
  try {
    console.log("\n🔍 Debugging Manager Access to User Management...\n");

    // Find the manager user
    const manager = await prisma.user.findUnique({
      where: { email: "sharna089.vishal@gmail.com" },
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
        venuePermissions: {
          include: {
            permission: true,
            venue: true,
          },
        },
        venues: {
          include: {
            venue: true,
          },
        },
      },
    });

    if (!manager) {
      console.error("❌ Manager user not found!");
      return;
    }

    console.log("✅ Manager Found:");
    console.log(`   ID: ${manager.id}`);
    console.log(`   Email: ${manager.email}`);
    console.log(`   Active: ${manager.active}`);
    console.log(`   Role: ${manager.role.name}`);
    console.log(`   Role ID: ${manager.role.id}\n`);

    // Check if role is MANAGER
    console.log("📋 Role Check:");
    if (manager.role.name === "MANAGER") {
      console.log("   ✅ User has MANAGER role");
    } else {
      console.log(`   ⚠️  User role is ${manager.role.name}, not MANAGER`);
    }
    console.log();

    // Check assigned venues
    console.log("🏢 Assigned Venues:");
    if (manager.venues.length === 0) {
      console.log("   ⚠️  No venues assigned!");
    } else {
      manager.venues.forEach((uv) => {
        console.log(`   - ${uv.venue.name} (ID: ${uv.venueId})`);
      });
    }
    console.log();

    // Check role permissions
    console.log("🔐 Role Permissions:");
    const rolePermissions = manager.role.rolePermissions.map((rp) => ({
      resource: rp.permission.resource,
      action: rp.permission.action,
    }));

    console.log(`   Total: ${rolePermissions.length} permissions`);

    // Check for specific user management permissions
    const userViewTeam = rolePermissions.find(
      (p) => p.resource === "users" && p.action === "view_team"
    );
    const userEditTeam = rolePermissions.find(
      (p) => p.resource === "users" && p.action === "edit_team"
    );

    if (userViewTeam) {
      console.log("   ✅ Has users:view_team permission");
    } else {
      console.log("   ❌ Missing users:view_team permission");
    }

    if (userEditTeam) {
      console.log("   ✅ Has users:edit_team permission");
    } else {
      console.log("   ⚠️  Missing users:edit_team permission");
    }
    console.log();

    // Check venue-specific permissions
    console.log("🎯 Venue-Specific Permissions:");
    if (manager.venuePermissions.length === 0) {
      console.log("   No venue-specific permissions (using role permissions)");
    } else {
      manager.venuePermissions.forEach((vp) => {
        console.log(
          `   - ${vp.permission.resource}:${vp.permission.action} at ${vp.venue.name}`
        );
      });
    }
    console.log();

    // Simulate the permission check
    console.log("🧪 Simulating Permission Check:");
    console.log("   Checking: requireAnyPermission([{ resource: 'users', action: 'view_team' }])");

    // Check if user is admin (admin bypass)
    const isAdmin = manager.role.name === "ADMIN";
    console.log(`   Admin Check: ${isAdmin ? "✅ IS ADMIN (bypass all checks)" : "❌ Not admin"}`);

    if (!isAdmin) {
      // Check if user is active
      if (!manager.active) {
        console.log("   ❌ User is INACTIVE - will fail auth check");
      } else {
        console.log("   ✅ User is active");
      }

      // Check role permission
      const hasRolePermission = rolePermissions.some(
        (p) => p.resource === "users" && p.action === "view_team"
      );
      console.log(`   Role Permission: ${hasRolePermission ? "✅ HAS users:view_team" : "❌ MISSING users:view_team"}`);

      // Final result
      console.log();
      if (hasRolePermission) {
        console.log("   ✅ SHOULD HAVE ACCESS");
      } else {
        console.log("   ❌ SHOULD BE DENIED ACCESS");
      }
    }
    console.log();

    // Check all user management related permissions
    console.log("📊 All User Management Permissions:");
    const userPerms = rolePermissions.filter((p) => p.resource === "users");
    if (userPerms.length === 0) {
      console.log("   ❌ No user management permissions found!");
    } else {
      userPerms.forEach((p) => {
        console.log(`   - users:${p.action}`);
      });
    }
    console.log();

    // Check for other admin permissions
    console.log("📊 Other Admin Permissions:");
    const adminPerms = rolePermissions.filter(
      (p) =>
        p.resource === "reports" ||
        p.resource === "schedules" ||
        p.resource === "channels"
    );
    adminPerms.forEach((p) => {
      console.log(`   - ${p.resource}:${p.action}`);
    });
    console.log();

    // List ALL permissions for debugging
    console.log("📋 Complete Permission List:");
    rolePermissions.forEach((p) => {
      console.log(`   - ${p.resource}:${p.action}`);
    });
    console.log();

    // Check if there's a session or auth issue
    console.log("💡 Troubleshooting Tips:");
    console.log("   1. Have the manager logout and login again to refresh session");
    console.log("   2. Clear browser cookies for localhost:3000");
    console.log("   3. Check browser console for any auth errors");
    console.log("   4. Verify Supabase session is valid");
    console.log("   5. Check if middleware is blocking the route");
    console.log();

    console.log("✅ Debug complete!\n");

  } catch (error) {
    console.error("❌ Error debugging manager access:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugManagerAccess();
