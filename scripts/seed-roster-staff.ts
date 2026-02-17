import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), ".env.local") });

// Use DIRECT_URL if available (for scripts), otherwise DATABASE_URL
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  log: ["error", "warn"],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// Staff from the roster image
const rosterStaff = [
  // All rounders (Kitchen, Drivers, Bar)
  { firstName: "Scott", lastName: "", position: "All rounders" },
  { firstName: "Debashish", lastName: "Sarkar Durjoy", position: "All rounders" },
  { firstName: "Harnisha", lastName: "Patel", position: "All rounders" },
  { firstName: "Krishna", lastName: "Sujon", position: "All rounders" },
  { firstName: "Luka", lastName: "Janaia Lalic", position: "All rounders" },
  { firstName: "Nick", lastName: "", position: "All rounders" },
  { firstName: "Shanarlla", lastName: "", position: "All rounders" },
  { firstName: "Vish", lastName: "", position: "All rounders" },

  // Kitchen Hand
  { firstName: "Simarjit", lastName: "Kaur", position: "Kitchen Hand" },

  // Managers
  { firstName: "Amandeep", lastName: "Kaur", position: "Manager", isManager: true },
  { firstName: "Michael", lastName: "Wheatley", position: "Manager", isManager: true },

  // Kitchen, Floor and Bar (No Delivery) - Has RSA
  { firstName: "Anjali", lastName: "Arora", position: "Kitchen Floor Bar RSA" },
  { firstName: "Bishal", lastName: "Kumar Mahato", position: "Kitchen Floor Bar RSA" },
  { firstName: "Simran", lastName: "Arora", position: "Kitchen Floor Bar RSA" },

  // Kitchen and Floor Staff (No bar) - Under Age
  { firstName: "Keeley", lastName: "Rivers", position: "Kitchen Floor Under Age" },

  // Kitchen, Floor and Delivery (No RSA)
  { firstName: "Kaitlyn", lastName: "Williams", position: "Kitchen Floor Delivery" },
];

async function main() {
  console.log("🌱 Seeding roster staff for Good Times Pizza and Bar...\n");

  // Find the venue
  const venue = await prisma.venue.findFirst({
    where: {
      OR: [
        { name: { contains: "Good Times", mode: "insensitive" } },
        { name: { contains: "Pizza", mode: "insensitive" } },
      ],
    },
  });

  if (!venue) {
    console.log("Creating venue 'Good Times Pizza and Bar'...");
    const newVenue = await prisma.venue.create({
      data: {
        name: "Good Times Pizza and Bar",
        code: "GTPB",
        active: true,
      },
    });
    console.log(`✅ Created venue: ${newVenue.name} (${newVenue.id})\n`);
    await seedStaff(newVenue.id);
  } else {
    console.log(`Using existing venue: ${venue.name} (${venue.id})\n`);
    await seedStaff(venue.id);
  }
}

async function seedStaff(venueId: string) {
  // Get roles
  const staffRole = await prisma.role.findUnique({ where: { name: "STAFF" } });
  const managerRole = await prisma.role.findUnique({ where: { name: "MANAGER" } });

  if (!staffRole || !managerRole) {
    throw new Error("Roles not found. Please run the main seed first.");
  }

  const defaultPassword = await bcrypt.hash("password123", 10);
  let created = 0;
  let skipped = 0;

  for (const staff of rosterStaff) {
    const email = generateEmail(staff.firstName, staff.lastName);

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`⏭️  Skipping ${staff.firstName} ${staff.lastName} (already exists)`);
      skipped++;
      continue;
    }

    const roleId = staff.isManager ? managerRole.id : staffRole.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        firstName: staff.firstName,
        lastName: staff.lastName || null,
        password: defaultPassword,
        roleId,
        active: true,
      },
    });

    // Assign to venue
    await prisma.userVenue.create({
      data: {
        userId: user.id,
        venueId,
        isPrimary: true,
      },
    });

    console.log(`✅ Created: ${staff.firstName} ${staff.lastName || ""} (${email}) - ${staff.position}`);
    created++;
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
  console.log(`🔐 Default password for all new users: password123`);
}

function generateEmail(firstName: string, lastName: string): string {
  const first = firstName.toLowerCase().replace(/\s+/g, "");
  const last = lastName ? lastName.toLowerCase().replace(/\s+/g, ".") : "";
  const domain = "goodtimespizza.test";

  if (last) {
    return `${first}.${last}@${domain}`;
  }
  return `${first}@${domain}`;
}

main()
  .catch((e) => {
    console.error("Error seeding roster staff:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
