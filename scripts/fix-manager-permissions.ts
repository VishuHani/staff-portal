import { prisma } from "../src/lib/prisma";

/**
 * Fix Manager Role Permissions
 *
 * This script ensures the MANAGER role has all required permissions
 * as defined in the seed file. It identifies and adds any missing permissions.
 */

async function fixManagerPermissions() {
  try {
    console.log("\n🔍 Checking MANAGER role permissions...\n");

    // Find the MANAGER role
    const managerRole = await prisma.role.findUnique({
      where: { name: "MANAGER" },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!managerRole) {
      console.error("❌ MANAGER role not found in database!");
      return;
    }

    console.log(`✓ Found MANAGER role (ID: ${managerRole.id})\n`);

    // Expected permissions for MANAGER (from seed file)
    const expectedPermissions = [
      { resource: "availability", action: "view_own" },
      { resource: "availability", action: "edit_own" },
      { resource: "availability", action: "view_team" },
      { resource: "availability", action: "edit_team" },
      { resource: "time_off", action: "create" },
      { resource: "time_off", action: "view_own" },
      { resource: "time_off", action: "view_team" },
      { resource: "time_off", action: "approve" },
      { resource: "posts", action: "create" },
      { resource: "posts", action: "view" },
      { resource: "posts", action: "edit_own" },
      { resource: "posts", action: "delete_own" },
      { resource: "posts", action: "moderate" },
      { resource: "posts", action: "manage" },
      { resource: "messages", action: "send" },
      { resource: "messages", action: "view" },
      { resource: "channels", action: "create" },
      { resource: "channels", action: "edit" },
      { resource: "channels", action: "moderate" },
      { resource: "users", action: "view_team" },
      { resource: "users", action: "edit_team" },
      { resource: "schedules", action: "view_own" },
      { resource: "schedules", action: "view_team" },
      { resource: "schedules", action: "edit_team" },
      { resource: "schedules", action: "publish" },
      { resource: "reports", action: "view_team" },
      { resource: "reports", action: "export_team" },
      { resource: "reports", action: "view_ai" },
      // Legacy permissions (for backwards compatibility)
      { resource: "timeoff", action: "create" },
      { resource: "timeoff", action: "view_own" },
      { resource: "timeoff", action: "view_team" },
      { resource: "timeoff", action: "approve" },
    ];

    // Get current permissions
    const currentPermissions = managerRole.rolePermissions.map((rp) => ({
      resource: rp.permission.resource,
      action: rp.permission.action,
    }));

    console.log(`📊 Current Permissions: ${currentPermissions.length}`);
    console.log(`📊 Expected Permissions: ${expectedPermissions.length}\n`);

    // Find missing permissions
    const missingPermissions = expectedPermissions.filter(
      (expected) =>
        !currentPermissions.some(
          (current) =>
            current.resource === expected.resource &&
            current.action === expected.action
        )
    );

    if (missingPermissions.length === 0) {
      console.log("✅ All permissions are correctly assigned!");
      console.log("\n📝 Current MANAGER permissions:");
      currentPermissions.forEach((perm) => {
        console.log(`   - ${perm.resource}:${perm.action}`);
      });
      return;
    }

    console.log(`⚠️  Found ${missingPermissions.length} missing permissions:\n`);
    missingPermissions.forEach((perm) => {
      console.log(`   ❌ ${perm.resource}:${perm.action}`);
    });

    console.log("\n🔧 Adding missing permissions...\n");

    // Add missing permissions
    let addedCount = 0;
    for (const perm of missingPermissions) {
      // Find or create the permission
      let permission = await prisma.permission.findUnique({
        where: {
          resource_action: {
            resource: perm.resource,
            action: perm.action,
          },
        },
      });

      if (!permission) {
        console.log(`   Creating permission: ${perm.resource}:${perm.action}`);
        permission = await prisma.permission.create({
          data: {
            resource: perm.resource,
            action: perm.action,
            description: `${perm.action} ${perm.resource}`,
          },
        });
      }

      // Add role permission
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: managerRole.id,
            permissionId: permission.id,
          },
        });
        console.log(`   ✓ Added: ${perm.resource}:${perm.action}`);
        addedCount++;
      } catch (error: any) {
        if (error.code === "P2002") {
          console.log(`   ⚠️  Already exists: ${perm.resource}:${perm.action}`);
        } else {
          console.error(`   ❌ Error adding ${perm.resource}:${perm.action}:`, error.message);
        }
      }
    }

    console.log(`\n✅ Successfully added ${addedCount} permissions to MANAGER role!\n`);

    // Verify final state
    const updatedRole = await prisma.role.findUnique({
      where: { name: "MANAGER" },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    console.log(`📊 Final permission count: ${updatedRole?.rolePermissions.length}\n`);

    console.log("✅ MANAGER role permissions fixed successfully!\n");
    console.log("🔄 Please test manager access to:");
    console.log("   1. User Management (/admin/users)");
    console.log("   2. Reports & Analytics (/admin/reports)");
    console.log("   3. Time-Off Approval (/admin/time-off)\n");

  } catch (error) {
    console.error("❌ Error fixing manager permissions:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixManagerPermissions();
