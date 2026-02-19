import { prisma } from "../src/lib/prisma";
import { getSharedVenueUsers } from "../src/lib/utils/venue";

async function checkSharedVenueUsers() {
  try {
    const managerEmail = "sharna089.vishal@gmail.com";

    // Find the manager
    const manager = await prisma.user.findFirst({
      where: { email: managerEmail },
    });

    if (!manager) {
      console.log("❌ Manager not found");
      return;
    }

    console.log(`\n📊 Checking shared venue users for: ${manager.firstName} ${manager.lastName}`);
    console.log("=".repeat(60));

    // Get manager's venue IDs
    const managerVenues = await prisma.userVenue.findMany({
      where: { userId: manager.id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    console.log(`\n🏢 Manager's Venues:`);
    managerVenues.forEach((uv) => {
      console.log(`  - ${uv.venue.name} (${uv.venue.code})`);
    });

    const venueIds = managerVenues.map((uv) => uv.venueId);

    // Get all users in the same venues
    const usersInSameVenues = await prisma.user.findMany({
      where: {
        id: { not: manager.id },
        active: true,
        venues: {
          some: {
            venueId: { in: venueIds },
          },
        },
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
        venues: {
          include: {
            venue: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    console.log(`\n👥 Users in Shared Venues (${usersInSameVenues.length} total):`);
    console.log("=".repeat(60));

    if (usersInSameVenues.length === 0) {
      console.log("  ⚠️  NO OTHER USERS found in manager's venues!");
      console.log("  This is why chat shows no users.");
    } else {
      usersInSameVenues.forEach((user) => {
        console.log(`\n  User: ${user.firstName} ${user.lastName}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role.name}`);
        console.log(`  Venues:`);
        user.venues.forEach((uv) => {
          const isShared = venueIds.includes(uv.venueId);
          console.log(`    ${isShared ? "✓" : " "} ${uv.venue.name} (${uv.venue.code})`);
        });
      });
    }

    // Use the utility function to compare
    console.log(`\n🔍 Using getSharedVenueUsers utility:`);
    console.log("=".repeat(60));
    const sharedUserIds = await getSharedVenueUsers(manager.id);
    console.log(`Found ${sharedUserIds.length} shared venue users`);
    console.log(`User IDs: ${sharedUserIds.join(", ")}`);

    // Get details of shared users
    if (sharedUserIds.length > 0) {
      const sharedUsers = await prisma.user.findMany({
        where: {
          id: { in: sharedUserIds.filter(id => id !== manager.id) },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      console.log(`\n👥 Shared venue users (excluding manager):`);
      sharedUsers.forEach((u) => {
        console.log(`  - ${u.firstName} ${u.lastName} (${u.email})`);
      });
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSharedVenueUsers();
