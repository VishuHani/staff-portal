/**
 * Test edge cases for AI Query Parser
 * Run with: npx tsx scripts/test-ai-parser-edge-cases.ts
 */

import dotenv from "dotenv";
import { parseQuery, describeQuery, resolveVenueNames, resolveRoleNames, resolveUserNames } from "../src/lib/ai/query-parser";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const edgeCaseQueries = [
  // Empty/invalid queries
  "",
  "   ",
  "help",
  "what can you do?",

  // Ambiguous dates
  "show me availability",
  "conflicts report",

  // Multiple filters
  "Show me critical and warning conflicts for managers and staff at Downtown and Uptown stores next week",

  // Unusual phrasing
  "give me everyone who can work Saturdays",
  "I need to see who's not available tomorrow",
  "find me people working on Christmas",

  // Multiple date references
  "show me conflicts from last week to next month",
];

const mockVenues = [
  { id: "v1", name: "Downtown Store", code: "DT" },
  { id: "v2", name: "Uptown Location", code: "UP" },
  { id: "v3", name: "East Side Shop", code: "ES" },
];

const mockRoles = [
  { id: "r1", name: "ADMIN" },
  { id: "r2", name: "MANAGER" },
  { id: "r3", name: "STAFF" },
];

const mockUsers = [
  { id: "u1", email: "john@test.com", firstName: "John", lastName: "Doe" },
  { id: "u2", email: "jane@test.com", firstName: "Jane", lastName: "Smith" },
  { id: "u3", email: "bob@test.com", firstName: null, lastName: null },
];

async function testEdgeCases() {
  console.log("🧪 Testing AI Query Parser Edge Cases\n");
  console.log("=" .repeat(80));

  for (const query of edgeCaseQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log("-".repeat(80));

    try {
      const parsed = await parseQuery(query);
      console.log("✅ Parsed Result:");
      console.log(JSON.stringify(parsed, null, 2));
      console.log(`\n📊 Description: ${describeQuery(parsed)}`);

      // Test name resolution
      if (parsed.venueNames && parsed.venueNames.length > 0) {
        const venueIds = await resolveVenueNames(parsed.venueNames, mockVenues);
        console.log(`\n🏢 Resolved Venues: ${venueIds.length} matches`);
      }

      if (parsed.roleNames && parsed.roleNames.length > 0) {
        const roleIds = await resolveRoleNames(parsed.roleNames, mockRoles);
        console.log(`\n👤 Resolved Roles: ${roleIds.length} matches`);
      }

      if (parsed.userNames && parsed.userNames.length > 0) {
        const userIds = await resolveUserNames(parsed.userNames, mockUsers);
        console.log(`\n👥 Resolved Users: ${userIds.length} matches`);
      }
    } catch (error: any) {
      console.error("❌ Error:", error.message);
    }

    console.log("=".repeat(80));
  }

  console.log("\n✨ Edge case testing complete!\n");
}

testEdgeCases().catch(console.error);
