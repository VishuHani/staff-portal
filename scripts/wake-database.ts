/**
 * Wake up paused Supabase database
 *
 * Supabase pauses free-tier databases after 7 days of inactivity.
 * This script makes a simple API request to wake it up.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function wakeDatabase() {
  console.log('🔄 Attempting to wake Supabase database...');
  console.log(`   URL: ${SUPABASE_URL}`);

  try {
    // Make a simple API request to wake the database
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    console.log(`   Response status: ${response.status}`);

    if (response.ok || response.status === 404) {
      console.log('✅ Database wake-up request sent successfully!');
      console.log('⏳ Please wait 30-60 seconds for the database to start...');
      console.log('');
      console.log('💡 Then try running your app again:');
      console.log('   npm run dev');
      return true;
    } else {
      console.log('⚠️  Unexpected response:', response.status, response.statusText);
      const text = await response.text();
      console.log('   Response:', text.substring(0, 200));
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error waking database:', error.message);
    console.log('');
    console.log('📋 Manual steps to wake your database:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/agelyuwscfuepwbgiilc');
    console.log('   2. Click on any page (SQL Editor, Table Editor, etc.)');
    console.log('   3. Wait 30-60 seconds for the database to start');
    console.log('   4. Come back and run: npm run dev');
    return false;
  }
}

wakeDatabase()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
