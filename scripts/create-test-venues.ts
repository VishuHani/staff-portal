import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('🏪 Creating test venues and users...\n');

  // Get or create roles
  let adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: 'ADMIN', description: 'Full system administrator' }
    });
  }

  let staffRole = await prisma.role.findUnique({ where: { name: 'STAFF' } });
  if (!staffRole) {
    staffRole = await prisma.role.create({
      data: { name: 'STAFF', description: 'Standard staff member' }
    });
  }

  // Create Venue 1: Good Times Pizza & Bar
  const venue1 = await prisma.venue.upsert({
    where: { code: 'GOOD_TIMES' },
    update: {},
    create: {
      name: 'Good Times Pizza & Bar',
      code: 'GOOD_TIMES',
      active: true,
      businessHoursStart: '08:00',
      businessHoursEnd: '22:00',
      operatingDays: [1, 2, 3, 4, 5, 6, 7],
    },
  });
  console.log(`✅ Created venue: ${venue1.name} (${venue1.id})`);

  // Create Venue 2: Singo Pizza Crew
  const venue2 = await prisma.venue.upsert({
    where: { code: 'SINGO_PIZZA' },
    update: {},
    create: {
      name: 'Singo Pizza Crew',
      code: 'SINGO_PIZZA',
      active: true,
      businessHoursStart: '08:00',
      businessHoursEnd: '22:00',
      operatingDays: [1, 2, 3, 4, 5, 6, 7],
    },
  });
  console.log(`✅ Created venue: ${venue2.name} (${venue2.id})`);

  // Create users for Venue 1
  const venue1Users = [
    { email: 'amandeep.kaur@goodtimes.com', firstName: 'Amandeep', lastName: 'Kaur' },
    { email: 'nick.wilson@goodtimes.com', firstName: 'Nick', lastName: 'Wilson' },
  ];

  for (const userData of venue1Users) {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password,
      options: {
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
        emailRedirectTo: undefined,
      },
    });

    if (authError && !authError.message.includes('already registered')) {
      console.error(`❌ Error creating Supabase user for ${userData.email}:`, authError.message);
      continue;
    }

    const supabaseUserId = authData.user?.id;
    if (!supabaseUserId) {
      console.error(`❌ No Supabase user ID for ${userData.email}`);
      continue;
    }

    // Create in Prisma database
    await prisma.user.upsert({
      where: { id: supabaseUserId },
      update: {},
      create: {
        id: supabaseUserId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: hashedPassword,
        roleId: staffRole.id,
        active: true,
        profileCompletedAt: new Date(),
      },
    });

    // Assign to venue
    await prisma.userVenue.create({
      data: {
        userId: supabaseUserId,
        venueId: venue1.id,
      },
    });

    console.log(`   ✅ Created user: ${userData.email} (${userData.firstName} ${userData.lastName})`);
  }

  // Create users for Venue 2
  const venue2Users = [
    { email: 'john.doe@singopizza.com', firstName: 'John', lastName: 'Doe' },
    { email: 'jane.smith@singopizza.com', firstName: 'Jane', lastName: 'Smith' },
  ];

  for (const userData of venue2Users) {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password,
      options: {
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
        emailRedirectTo: undefined,
      },
    });

    if (authError && !authError.message.includes('already registered')) {
      console.error(`❌ Error creating Supabase user for ${userData.email}:`, authError.message);
      continue;
    }

    const supabaseUserId = authData.user?.id;
    if (!supabaseUserId) {
      console.error(`❌ No Supabase user ID for ${userData.email}`);
      continue;
    }

    // Create in Prisma database
    await prisma.user.upsert({
      where: { id: supabaseUserId },
      update: {},
      create: {
        id: supabaseUserId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: hashedPassword,
        roleId: staffRole.id,
        active: true,
        profileCompletedAt: new Date(),
      },
    });

    // Assign to venue
    await prisma.userVenue.create({
      data: {
        userId: supabaseUserId,
        venueId: venue2.id,
      },
    });

    console.log(`   ✅ Created user: ${userData.email} (${userData.firstName} ${userData.lastName})`);
  }

  console.log('\n=== Summary ===');
  console.log('Venues created:');
  console.log(`  1. ${venue1.name} (${venue1.code})`);
  console.log(`  2. ${venue2.name} (${venue2.code})`);
  console.log('\nUsers created:');
  console.log('  Venue 1 - Good Times Pizza & Bar:');
  console.log(`    - ${venue1Users[0].email} (${venue1Users[0].firstName} ${venue1Users[0].lastName})`);
  console.log(`    - ${venue1Users[1].email} (${venue1Users[1].firstName} ${venue1Users[1].lastName})`);
  console.log('  Venue 2 - Singo Pizza Crew:');
  console.log(`    - ${venue2Users[0].email} (${venue2Users[0].firstName} ${venue2Users[0].lastName})`);
  console.log(`    - ${venue2Users[1].email} (${venue2Users[1].firstName} ${venue2Users[1].lastName})`);
  console.log('\nAll passwords: password123');
  console.log('\nYou can now log in with any of these accounts at http://localhost:3000/login');
}

main()
  .catch((error) => {
    console.error('❌ Error creating test venues and users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
