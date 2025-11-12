/**
 * Test script for AI Query Parser
 * Run with: npx tsx scripts/test-ai-parser.ts
 */

import dotenv from "dotenv";
import { parseQuery, describeQuery } from "../src/lib/ai/query-parser";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const testQueries = [
  "Show me availability conflicts for next week",
  "Who is available on Mondays at the Downtown store?",
  "Coverage report for all venues in February",
  "Show critical conflicts for managers next month",
  "What's the availability matrix for this week?",
  "Calendar view for next 7 days",
  "Show me all conflicts today",
  "Who is working on weekends?",
  "Coverage report for next month at all stores",
  "Show availability for tomorrow",
];

async function testParser() {
  console.log("🤖 Testing AI Query Parser\n");
  console.log("=" .repeat(80));

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log("-".repeat(80));

    try {
      const parsed = await parseQuery(query);
      console.log("✅ Parsed Result:");
      console.log(JSON.stringify(parsed, null, 2));
      console.log(`\n📊 Description: ${describeQuery(parsed)}`);
    } catch (error: any) {
      console.error("❌ Error:", error.message);
    }

    console.log("=".repeat(80));
  }

  console.log("\n✨ Testing complete!\n");
}

testParser().catch(console.error);
