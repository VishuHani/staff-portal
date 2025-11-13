/**
 * Seed Test Data for Reporting System
 * Creates realistic availability, time-off, and staff data for testing reports
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";
import { addDays, subDays, format } from "date-fns";

config({ path: path.join(process.cwd(), ".env.local") });

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("🌱 Seeding test data for reporting system...\n");

  // Get existing data
  const venues = await prisma.venue.findMany();
  const roles = await prisma.role.findMany();
  const staffRole = roles.find((r) => r.name === "STAFF");
  const managerRole = roles.find((r) => r.name === "MANAGER");

  if (!staffRole || !managerRole) {
    throw new Error("Required roles not found. Please run main seed first.");
  }

  if (venues.length === 0) {
    throw new Error("No venues found. Please run main seed first.");
  }

  console.log(`Found ${venues.length} venues and ${roles.length} roles\n`);

  // Check for existing test users
  const existingTestUsers = await prisma.user.count({
    where: {
      email: {
        contains: "teststaff",
      },
    },
  });

  if (existingTestUsers > 0) {
    console.log(`⚠️  Found ${existingTestUsers} existing test users.`);
    console.log("Do you want to delete them and create fresh data? (This script will exit now)");
    console.log("To clean up: Run 'npx prisma studio' and manually delete test users,");
    console.log("or add cleanup logic to this script.\n");
  }

  // Create 12 test staff members across venues
  console.log("Creating test staff members...");
  const testUsers = [];

  const firstNames = [
    "Emma",
    "Liam",
    "Olivia",
    "Noah",
    "Ava",
    "Ethan",
    "Sophia",
    "Mason",
    "Isabella",
    "Logan",
    "Mia",
    "Lucas",
  ];
  const lastNames = [
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Wilson",
    "Anderson",
    "Taylor",
  ];

  for (let i = 0; i < 12; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    const email = `teststaff${i + 1}@staffportal.test`;
    const venueIndex = i % venues.length; // Distribute across venues
    const isManager = i < 2; // First 2 are managers

    try {
      const user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          roleId: isManager ? managerRole.id : staffRole.id,
          venueId: venues[venueIndex].id,
          active: true,
          venues: {
            create: {
              venueId: venues[venueIndex].id,
            },
          },
        },
      });

      testUsers.push(user);
      console.log(`  ✅ Created: ${firstName} ${lastName} (${isManager ? "Manager" : "Staff"}) - ${venues[venueIndex].name}`);
    } catch (error: any) {
      if (error.code === "P2002") {
        console.log(`  ⚠️  User ${email} already exists, skipping...`);
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) testUsers.push(existingUser);
      } else {
        throw error;
      }
    }
  }

  console.log(`\n✅ Created ${testUsers.length} test users\n`);

  // Create availability schedules for all test users
  console.log("Creating availability schedules...");
  let availabilityCount = 0;

  for (const user of testUsers) {
    // Create a realistic weekly schedule
    // Most staff work Mon-Fri, some work weekends
    const worksWeekends = Math.random() > 0.7; // 30% work weekends
    const isFullTime = Math.random() > 0.3; // 70% full-time

    // Monday - Friday
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      if (isFullTime || Math.random() > 0.2) {
        // Full-time works all days, part-time works most days
        const isAllDay = Math.random() > 0.6; // 40% work specific hours
        const startHour = isAllDay ? 0 : 9 + Math.floor(Math.random() * 3); // 9am-11am
        const endHour = isAllDay ? 0 : 17 + Math.floor(Math.random() * 3); // 5pm-7pm

        await prisma.availability.create({
          data: {
            userId: user.id,
            dayOfWeek,
            isAllDay,
            isAvailable: true,
            startTime: isAllDay ? null : `${String(startHour).padStart(2, "0")}:00`,
            endTime: isAllDay ? null : `${String(endHour).padStart(2, "0")}:00`,
          },
        });
        availabilityCount++;
      }
    }

    // Saturday
    if (worksWeekends) {
      await prisma.availability.create({
        data: {
          userId: user.id,
          dayOfWeek: 6,
          isAllDay: false,
          isAvailable: true,
          startTime: "10:00",
          endTime: "18:00",
        },
      });
      availabilityCount++;
    }

    // Sunday (fewer people)
    if (worksWeekends && Math.random() > 0.5) {
      await prisma.availability.create({
        data: {
          userId: user.id,
          dayOfWeek: 0,
          isAllDay: false,
          isAvailable: true,
          startTime: "11:00",
          endTime: "17:00",
        },
      });
      availabilityCount++;
    }
  }

  console.log(`✅ Created ${availabilityCount} availability records\n`);

  // Create time-off requests
  console.log("Creating time-off requests...");
  const today = new Date();
  let timeOffCount = 0;

  // Mix of past, current, and future time-off
  const timeOffScenarios = [
    {
      // Upcoming vacation (approved)
      startDate: addDays(today, 7),
      endDate: addDays(today, 14),
      status: "APPROVED" as const,
      reason: "Annual vacation",
      type: "VACATION" as const,
    },
    {
      // This week (approved)
      startDate: addDays(today, 1),
      endDate: addDays(today, 3),
      status: "APPROVED" as const,
      reason: "Family emergency",
      type: "PERSONAL" as const,
    },
    {
      // Next month (pending)
      startDate: addDays(today, 30),
      endDate: addDays(today, 32),
      status: "PENDING" as const,
      reason: "Medical appointment",
      type: "SICK" as const,
    },
    {
      // Last week (approved)
      startDate: subDays(today, 7),
      endDate: subDays(today, 5),
      status: "APPROVED" as const,
      reason: "Sick leave",
      type: "SICK" as const,
    },
    {
      // Overlapping time-off for conflict testing
      startDate: addDays(today, 14),
      endDate: addDays(today, 16),
      status: "APPROVED" as const,
      reason: "Personal day",
      type: "PERSONAL" as const,
    },
  ];

  // Assign time-off to different users
  for (let i = 0; i < Math.min(8, testUsers.length); i++) {
    const scenario = timeOffScenarios[i % timeOffScenarios.length];
    const user = testUsers[i];

    try {
      await prisma.timeOffRequest.create({
        data: {
          userId: user.id,
          startDate: scenario.startDate,
          endDate: scenario.endDate,
          status: scenario.status,
          reason: scenario.reason,
          type: scenario.type,
        },
      });
      timeOffCount++;
      console.log(
        `  ✅ ${user.firstName} ${user.lastName}: ${scenario.type} (${scenario.status}) - ${format(scenario.startDate, "MMM dd")} to ${format(scenario.endDate, "MMM dd")}`
      );
    } catch (error) {
      console.log(`  ⚠️  Failed to create time-off for ${user.firstName}: ${error}`);
    }
  }

  console.log(`\n✅ Created ${timeOffCount} time-off requests\n`);

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 Test data seeded successfully!\n");
  console.log("Summary:");
  console.log(`  • ${testUsers.length} test staff members`);
  console.log(`  • ${availabilityCount} availability records`);
  console.log(`  • ${timeOffCount} time-off requests`);
  console.log("\nTest scenarios created:");
  console.log("  ✓ Mix of full-time and part-time staff");
  console.log("  ✓ Various availability patterns (all-day, partial-day)");
  console.log("  ✓ Weekend workers and weekday-only staff");
  console.log("  ✓ Overlapping time-off (for conflict detection)");
  console.log("  ✓ Approved, pending, and past time-off");
  console.log("\nYou can now test:");
  console.log("  • Availability Matrix: See staff schedules");
  console.log("  • Coverage Analysis: View coverage percentages");
  console.log("  • Conflicts Report: Detect scheduling conflicts");
  console.log("  • Calendar View: Monthly availability overview");
  console.log("  • Search: Try searching for staff names");
  console.log("  • Filters: Test venue and role filtering");
  console.log("\nTest user emails: teststaff1@staffportal.test through teststaff12@staffportal.test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding test data:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
