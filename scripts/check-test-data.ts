/**
 * Check Test Data Status
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

async function main() {
  console.log("📊 Checking test data status...\n");

  const testUsers = await prisma.user.count({
    where: { email: { contains: "teststaff" } },
  });

  const testAvailability = await prisma.availability.count({
    where: {
      user: { email: { contains: "teststaff" } },
    },
  });

  const testTimeOff = await prisma.timeOffRequest.count({
    where: {
      user: { email: { contains: "teststaff" } },
    },
  });

  console.log(`Test Users: ${testUsers}`);
  console.log(`Test Availability Records: ${testAvailability}`);
  console.log(`Test Time-Off Requests: ${testTimeOff}\n`);

  // Sample users
  const users = await prisma.user.findMany({
    where: { email: { contains: "teststaff" } },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      venue: { select: { name: true } },
    },
    take: 5,
  });

  console.log("Sample test users:");
  users.forEach((u) => {
    console.log(`  - ${u.firstName} ${u.lastName} (${u.venue?.name})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
