import { prisma } from "../src/lib/prisma";

async function checkManagerVenues() {
  try {
    // Find the manager user
    const manager = await prisma.user.findFirst({
      where: {
        email: "sharna089.vishal@gmail.com",
      },
      include: {
        role: {
          select: {
            name: true,
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
      },
    });

    if (!manager) {
      console.log("❌ Manager user not found");
      return;
    }

    console.log("\n📊 Manager User Details:");
    console.log("========================");
    console.log(`ID: ${manager.id}`);
    console.log(`Email: ${manager.email}`);
    console.log(`Name: ${manager.firstName} ${manager.lastName}`);
    console.log(`Role: ${manager.role.name}`);
    console.log(`Active: ${manager.active}`);

    console.log("\n🔐 Permissions:");
    console.log("================");
    manager.role.rolePermissions.forEach((rp) => {
      console.log(`  - ${rp.permission.resource}:${rp.permission.action}`);
    });

    console.log("\n🏢 Venue Assignments:");
    console.log("======================");
    if (manager.venues.length === 0) {
      console.log("  ⚠️  NO VENUES ASSIGNED - This is the problem!");
      console.log("  This is why the manager can't see users in chat.");
    } else {
      manager.venues.forEach((uv) => {
        console.log(`  - ${uv.venue.name} (${uv.venue.code})`);
        console.log(`    ID: ${uv.venue.id}`);
        console.log(`    Primary: ${uv.isPrimary}`);
        console.log(`    Active: ${uv.venue.active}`);
      });
    }

    // Get all active venues for reference
    const allVenues = await prisma.venue.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    });

    console.log("\n📍 All Active Venues:");
    console.log("=====================");
    allVenues.forEach((v) => {
      console.log(`  - ${v.name} (${v.code}) - ID: ${v.id}`);
    });

    console.log("\n💡 Next Steps:");
    console.log("==============");
    if (manager.venues.length === 0) {
      console.log("  1. Assign the manager to one or more venues");
      console.log("  2. This can be done via the Admin user management UI");
      console.log("  3. Or by creating UserVenue records in the database");
    } else {
      console.log("  ✓ Manager has venue assignments");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkManagerVenues();
