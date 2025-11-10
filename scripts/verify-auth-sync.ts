import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('🔄 Checking Sync Between Supabase Auth and Prisma Database...\n');

async function checkSync() {
  try {
    // Get users from Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching Supabase users:', authError.message);
      return;
    }

    console.log(`📊 Supabase Auth Users: ${authData.users.length}`);
    console.log('─────────────────────────────────────────────────');
    for (const user of authData.users) {
      console.log(`   ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log('');
    }

    // Get users from Prisma
    const prismaUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        active: true,
        role: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`📊 Prisma Database Users: ${prismaUsers.length}`);
    console.log('─────────────────────────────────────────────────');
    for (const user of prismaUsers) {
      console.log(`   ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role?.name || 'None'}`);
      console.log(`   Active: ${user.active}`);
      console.log('');
    }

    // Compare and find mismatches
    console.log('🔍 Sync Analysis:');
    console.log('─────────────────────────────────────────────────');

    const authEmails = new Set(authData.users.map(u => u.email));
    const prismaEmails = new Set(prismaUsers.map(u => u.email));

    // Users in Supabase but not in Prisma
    const missingInPrisma = authData.users.filter(u => !prismaEmails.has(u.email!));
    if (missingInPrisma.length > 0) {
      console.log('⚠️  Users in Supabase Auth but NOT in Prisma:');
      for (const user of missingInPrisma) {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      }
      console.log('   This will prevent login! Users need to be in BOTH systems.\n');
    }

    // Users in Prisma but not in Supabase
    const missingInSupabase = prismaUsers.filter(u => !authEmails.has(u.email));
    if (missingInSupabase.length > 0) {
      console.log('⚠️  Users in Prisma but NOT in Supabase Auth:');
      for (const user of missingInSupabase) {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      }
      console.log('   These users cannot log in!\n');
    }

    // Check ID matches
    console.log('🔐 Checking User ID Matches:');
    for (const authUser of authData.users) {
      const prismaUser = prismaUsers.find(u => u.email === authUser.email);
      if (prismaUser) {
        const idsMatch = prismaUser.id === authUser.id;
        console.log(`   ${authUser.email}: ${idsMatch ? '✅ IDs match' : '❌ IDs DO NOT match'}`);
        if (!idsMatch) {
          console.log(`      Supabase: ${authUser.id}`);
          console.log(`      Prisma:   ${prismaUser.id}`);
        }
      }
    }

    console.log('\n📋 Summary:');
    console.log('─────────────────────────────────────────────────');

    if (missingInPrisma.length === 0 && missingInSupabase.length === 0) {
      console.log('✅ All users are synced between Supabase Auth and Prisma');
    } else {
      console.log('⚠️  SYNC ISSUES DETECTED');
      console.log(`   ${missingInPrisma.length} user(s) missing in Prisma`);
      console.log(`   ${missingInSupabase.length} user(s) missing in Supabase Auth`);
      console.log('\n   Users must exist in BOTH systems to log in successfully.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSync();
