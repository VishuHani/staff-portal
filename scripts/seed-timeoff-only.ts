/**
 * Seed Time-Off Requests Only
 * Adds time-off data for existing test users
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
  console.log("🌱 Seeding time-off requests for test users...\n");

  // Get existing test users
  const testUsers = await prisma.user.findMany({
    where: {
      email: {
        contains: "teststaff",
      },
    },
    orderBy: {
      email: "asc",
    },
  });

  if (testUsers.length === 0) {
    console.log("⚠️  No test users found. Run seed-reports-test-data.ts first.");
    return;
  }

  console.log(`Found ${testUsers.length} test users\n`);

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
  console.log("🎉 Time-off requests seeded successfully!\n");
  console.log(`Summary: ${timeOffCount} time-off requests for ${testUsers.length} test users`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding time-off data:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
