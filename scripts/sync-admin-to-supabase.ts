/**
 * One-time migration script to sync existing admin user to Supabase Auth
 *
 * Run with: npx tsx scripts/sync-admin-to-supabase.ts
 */

import { config } from "dotenv";
import path from "path";
import { syncExistingUserToSupabase } from "../src/lib/auth/admin-user";

// Load environment variables
config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  console.log("🔄 Syncing admin user to Supabase Auth...");

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local");
    process.exit(1);
  }

  const result = await syncExistingUserToSupabase(ADMIN_EMAIL, ADMIN_PASSWORD);

  if (result.success) {
    console.log("✅ Admin user successfully synced to Supabase Auth!");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log("   You can now log in with these credentials!");
  } else {
    console.error("❌ Failed to sync admin user:", result.error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n✨ Sync complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
