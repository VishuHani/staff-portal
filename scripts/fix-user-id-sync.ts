import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('🔧 Fixing User ID Sync Issues...\n');

async function fixSync() {
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

    console.log('📊 Checking for ID mismatches...\n');

    for (const authUser of authData.users) {
      const email = authUser.email!;
      const supabaseId = authUser.id;

      // Find user in Prisma by email
      const prismaUser = await prisma.user.findUnique({
        where: { email }
      });

      if (!prismaUser) {
        console.log(`⚠️  User ${email} exists in Supabase but not in Prisma - skipping`);
        continue;
      }

      if (prismaUser.id !== supabaseId) {
        console.log(`🔄 Fixing ID mismatch for ${email}:`);
        console.log(`   Old Prisma ID: ${prismaUser.id}`);
        console.log(`   Supabase ID:   ${supabaseId}`);

        try {
          // Update the user ID in Prisma to match Supabase
          // This is a direct SQL update because Prisma doesn't allow updating IDs
          await prisma.$executeRaw`
            UPDATE users
            SET id = ${supabaseId}::uuid
            WHERE email = ${email}
          `;

          console.log(`   ✅ Updated Prisma ID to match Supabase\n`);
        } catch (error: any) {
          console.error(`   ❌ Failed to update: ${error.message}\n`);
        }
      } else {
        console.log(`✅ ${email}: IDs already match`);
      }
    }

    console.log('\n🔍 Verification - Checking sync after fixes...\n');

    // Verify the fix
    for (const authUser of authData.users) {
      const email = authUser.email!;
      const supabaseId = authUser.id;

      const prismaUser = await prisma.user.findUnique({
        where: { email }
      });

      if (prismaUser) {
        const match = prismaUser.id === supabaseId;
        console.log(`   ${email}: ${match ? '✅ Synced' : '❌ Still mismatched'}`);
      }
    }

    console.log('\n✅ Sync fix complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSync();
