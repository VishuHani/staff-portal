/**
 * Script to seed VenuePayConfig with default superannuation settings
 * Run with: npx ts-node scripts/seed-super-config.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding VenuePayConfig with super settings...\n');

  // Get all venues
  const venues = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM venues
  `;

  console.log(`Found ${venues.length} venues\n`);

  for (const venue of venues) {
    // Check if VenuePayConfig exists
    const existing = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM venue_pay_configs WHERE venue_id = ${venue.id}
    `;

    if (Number(existing[0].count) > 0) {
      // Update existing config with super settings
      await prisma.$executeRaw`
        UPDATE venue_pay_configs 
        SET super_enabled = COALESCE(super_enabled, true),
            super_rate = COALESCE(super_rate, 0.115)
        WHERE venue_id = ${venue.id}
      `;
      console.log(`✓ Updated super settings for: ${venue.name}`);
    } else {
      // Create new VenuePayConfig with super settings
      await prisma.$executeRaw`
        INSERT INTO venue_pay_configs (
          id, venue_id, super_enabled, super_rate, 
          default_weekday_rate, default_saturday_rate, default_sunday_rate, 
          default_public_holiday_rate, overtime_multiplier,
          overtime_threshold_hours, late_start_hour, auto_calculate_breaks, 
          break_threshold_hours, default_break_minutes, public_holiday_region,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${venue.id}, true, 0.115,
          25.00, 30.00, 35.00, 50.00, 1.5,
          8, 22, true,
          4, 30, 'NSW',
          NOW(), NOW()
        )
      `;
      console.log(`✓ Created VenuePayConfig for: ${venue.name}`);
    }
  }

  // Also update users without super settings
  console.log('\nUpdating user super settings...\n');
  
  // Update all users to have superEnabled = true by default
  const result = await prisma.$executeRaw`
    UPDATE users 
    SET super_enabled = true 
    WHERE super_enabled IS NULL
  `;

  console.log(`✓ Updated ${result} users with super_enabled = true`);

  // Verify the settings
  console.log('\nVerifying settings...\n');
  
  const venueConfigs = await prisma.$queryRaw<{ venue_id: string; super_enabled: boolean; super_rate: number }[]>`
    SELECT venue_id, super_enabled, super_rate FROM venue_pay_configs LIMIT 5
  `;
  
  for (const config of venueConfigs) {
    console.log(`  Venue ${config.venue_id}: super_enabled=${config.super_enabled}, super_rate=${config.super_rate}`);
  }

  console.log('\n✅ Done! Super settings have been seeded.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
