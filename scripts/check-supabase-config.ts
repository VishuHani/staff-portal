import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('🔍 Checking Supabase Configuration...\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key:', supabaseServiceKey ? '✅ Present' : '❌ Missing');
console.log('');

async function checkSupabaseConfig() {
  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('📊 Checking Auth Configuration...\n');

    // Test connection by listing users
    console.log('1️⃣ Testing Connection - Listing Users:');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
    } else {
      console.log(`✅ Connected! Found ${users.users.length} user(s)\n`);

      // Show user details
      for (const user of users.users) {
        console.log(`   User: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email Confirmed: ${user.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
        console.log('');
      }
    }

    // Check if we can access project settings
    console.log('2️⃣ Attempting to Check Project Settings:');
    console.log('⚠️  Note: Email settings (Site URL, SMTP, etc.) are only accessible via Dashboard');
    console.log('   The Auth API does not expose these configuration settings programmatically\n');

    // Test email sending capability by checking recent users
    console.log('3️⃣ Analyzing Recent Signups:');
    const recentUsers = users?.users.filter(u => {
      const createdAt = new Date(u.created_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return createdAt > oneDayAgo;
    }) || [];

    if (recentUsers.length > 0) {
      console.log(`   Found ${recentUsers.length} user(s) created in the last 24 hours:`);
      for (const user of recentUsers) {
        console.log(`   - ${user.email}: ${user.email_confirmed_at ? 'Confirmed ✅' : 'Not Confirmed ❌'}`);
      }
    } else {
      console.log('   No users created in the last 24 hours');
    }
    console.log('');

    // Summary and recommendations
    console.log('📋 Summary:');
    console.log('─────────────────────────────────────────────────');

    if (!users || users.users.length === 0) {
      console.log('⚠️  No users found in Supabase Auth');
      console.log('   This suggests the database was reset but users were not created in Supabase Auth');
    }

    const unconfirmedUsers = users?.users.filter(u => !u.email_confirmed_at) || [];
    if (unconfirmedUsers.length > 0) {
      console.log(`⚠️  ${unconfirmedUsers.length} user(s) have unconfirmed emails`);
      console.log('   This suggests email verification is not working');
    }

    console.log('\n🔧 To Fix Email Verification:');
    console.log('Since email settings are not accessible via API, you must configure in Dashboard:');
    console.log('1. Go to: https://supabase.com/dashboard/project/agelyuwscfuepwbgiilc');
    console.log('2. Settings → API → Configuration');
    console.log('   - Set Site URL: http://localhost:3000');
    console.log('3. Settings → API → Redirect URLs');
    console.log('   - Add: http://localhost:3000/auth/callback');
    console.log('   - Add: http://localhost:3000/**');
    console.log('4. Authentication → Providers → Email');
    console.log('   - Ensure "Confirm email" is enabled');
    console.log('5. Authentication → Settings → SMTP Settings');
    console.log('   - Verify SMTP is configured (or using Supabase SMTP)');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSupabaseConfig().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
