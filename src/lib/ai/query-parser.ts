/**
 * AI Query Parser
 * Converts natural language queries into structured report filters
 * using OpenAI GPT-4
 */

import OpenAI from "openai";
import { addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Structured filter result from AI parsing
 */
export interface ParsedQuery {
  reportType?: "availability" | "coverage" | "conflicts" | "calendar" | "matrix";
  dateRange?: {
    start: Date;
    end: Date;
  };
  venueIds?: string[];
  venueNames?: string[]; // Will be resolved to IDs
  roleIds?: string[];
  roleNames?: string[]; // Will be resolved to IDs
  userIds?: string[];
  userNames?: string[]; // Will be resolved to IDs
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  conflictSeverity?: "critical" | "warning" | "info";
  groupBy?: "venue" | "role" | "user" | "date";
  includeInactive?: boolean;
  raw?: string; // Original query
}

/**
 * System prompt for the AI query parser
 */
const SYSTEM_PROMPT = `You are an AI assistant that converts natural language queries into structured filters for a staff availability reporting system.

The system has the following report types:
- availability: Shows staff availability by day of week
- coverage: Shows how many staff are available for date ranges
- conflicts: Shows scheduling conflicts and staffing gaps
- calendar: Calendar view of availability
- matrix: Grid view of staff availability by date

Extract the following information from queries:
1. Report type (if mentioned or can be inferred)
2. Date range (handle relative dates like "next week", "this month", "next 7 days")
3. Venue names (store locations)
4. Role names (job positions like Manager, Staff, Admin)
5. User names or emails
6. Day of week (if asking about specific days like "Monday" or "weekends")
7. Conflict severity (critical, warning, info)
8. Grouping preference (by venue, role, user, or date)
9. Whether to include inactive users

Today's date is: ${format(new Date(), "yyyy-MM-dd (EEEE)")}

Return ONLY a valid JSON object with the extracted information. Use null for fields that aren't mentioned.

Example queries and expected output:

Query: "Show me availability conflicts for next week"
Output: {
  "reportType": "conflicts",
  "dateRange": { "start": "2025-01-13", "end": "2025-01-19" }
}

Query: "Who is available on Mondays at the Downtown store?"
Output: {
  "reportType": "availability",
  "dayOfWeek": 1,
  "venueNames": ["Downtown"]
}

Query: "Coverage report for all venues in February"
Output: {
  "reportType": "coverage",
  "dateRange": { "start": "2025-02-01", "end": "2025-02-28" }
}

Query: "Show critical conflicts for managers next month"
Output: {
  "reportType": "conflicts",
  "conflictSeverity": "critical",
  "roleNames": ["Manager"],
  "dateRange": { "start": "2025-02-01", "end": "2025-02-28" }
}

Return ONLY the JSON object, no additional text.`;

/**
 * Parse a natural language query into structured filters
 */
export async function parseQuery(query: string): Promise<ParsedQuery> {
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content) as ParsedQuery;

    // Convert date strings to Date objects
    if (parsed.dateRange) {
      parsed.dateRange = {
        start: new Date(parsed.dateRange.start as any),
        end: new Date(parsed.dateRange.end as any),
      };
    }

    // Store original query
    parsed.raw = query;

    return parsed;
  } catch (error) {
    console.error("Error parsing query with AI:", error);

    // Fallback: Basic rule-based parsing
    return fallbackParse(query);
  }
}

/**
 * Fallback parser using simple rules (when AI fails)
 */
function fallbackParse(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase();
  const result: ParsedQuery = { raw: query };

  // Detect report type
  if (lowerQuery.includes("conflict")) {
    result.reportType = "conflicts";
  } else if (lowerQuery.includes("coverage")) {
    result.reportType = "coverage";
  } else if (lowerQuery.includes("calendar")) {
    result.reportType = "calendar";
  } else if (lowerQuery.includes("matrix") || lowerQuery.includes("grid")) {
    result.reportType = "matrix";
  } else if (lowerQuery.includes("availability") || lowerQuery.includes("available")) {
    result.reportType = "availability";
  }

  // Detect date ranges
  const today = new Date();

  if (lowerQuery.includes("today")) {
    result.dateRange = { start: today, end: today };
  } else if (lowerQuery.includes("tomorrow")) {
    const tomorrow = addDays(today, 1);
    result.dateRange = { start: tomorrow, end: tomorrow };
  } else if (lowerQuery.includes("next week")) {
    const nextWeekStart = addWeeks(startOfWeek(today), 1);
    const nextWeekEnd = endOfWeek(nextWeekStart);
    result.dateRange = { start: nextWeekStart, end: nextWeekEnd };
  } else if (lowerQuery.includes("this week")) {
    result.dateRange = { start: startOfWeek(today), end: endOfWeek(today) };
  } else if (lowerQuery.includes("next month")) {
    const nextMonthStart = addMonths(startOfMonth(today), 1);
    const nextMonthEnd = endOfMonth(nextMonthStart);
    result.dateRange = { start: nextMonthStart, end: nextMonthEnd };
  } else if (lowerQuery.includes("this month")) {
    result.dateRange = { start: startOfMonth(today), end: endOfMonth(today) };
  } else if (lowerQuery.match(/next (\d+) days?/)) {
    const match = lowerQuery.match(/next (\d+) days?/);
    const days = parseInt(match![1]);
    result.dateRange = { start: today, end: addDays(today, days) };
  }

  // Detect day of week
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  days.forEach((day, index) => {
    if (lowerQuery.includes(day)) {
      result.dayOfWeek = index;
    }
  });

  // Detect severity
  if (lowerQuery.includes("critical")) {
    result.conflictSeverity = "critical";
  } else if (lowerQuery.includes("warning")) {
    result.conflictSeverity = "warning";
  }

  return result;
}

/**
 * Resolve venue names to IDs
 */
export async function resolveVenueNames(
  venueNames: string[],
  allVenues: Array<{ id: string; name: string; code: string }>
): Promise<string[]> {
  const venueIds: string[] = [];

  for (const name of venueNames) {
    const lowerName = name.toLowerCase();
    const venue = allVenues.find(
      (v) =>
        v.name.toLowerCase().includes(lowerName) ||
        v.code.toLowerCase().includes(lowerName) ||
        lowerName.includes(v.name.toLowerCase()) ||
        lowerName.includes(v.code.toLowerCase())
    );

    if (venue) {
      venueIds.push(venue.id);
    }
  }

  return venueIds;
}

/**
 * Resolve role names to IDs
 */
export async function resolveRoleNames(
  roleNames: string[],
  allRoles: Array<{ id: string; name: string }>
): Promise<string[]> {
  const roleIds: string[] = [];

  for (const name of roleNames) {
    const lowerName = name.toLowerCase();
    const role = allRoles.find(
      (r) =>
        r.name.toLowerCase().includes(lowerName) ||
        lowerName.includes(r.name.toLowerCase())
    );

    if (role) {
      roleIds.push(role.id);
    }
  }

  return roleIds;
}

/**
 * Resolve user names/emails to IDs
 */
export async function resolveUserNames(
  userNames: string[],
  allUsers: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>
): Promise<string[]> {
  const userIds: string[] = [];

  for (const name of userNames) {
    const lowerName = name.toLowerCase();
    const user = allUsers.find((u) => {
      const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      return (
        u.email.toLowerCase().includes(lowerName) ||
        lowerName.includes(u.email.toLowerCase()) ||
        fullName.includes(lowerName) ||
        lowerName.includes(fullName)
      );
    });

    if (user) {
      userIds.push(user.id);
    }
  }

  return userIds;
}

/**
 * Generate a human-friendly description of the parsed query
 */
export function describeQuery(parsed: ParsedQuery): string {
  const parts: string[] = [];

  if (parsed.reportType) {
    parts.push(`${parsed.reportType} report`);
  }

  if (parsed.dateRange) {
    const start = format(parsed.dateRange.start, "MMM dd");
    const end = format(parsed.dateRange.end, "MMM dd");
    if (start === end) {
      parts.push(`for ${start}`);
    } else {
      parts.push(`from ${start} to ${end}`);
    }
  }

  if (parsed.venueNames && parsed.venueNames.length > 0) {
    parts.push(`at ${parsed.venueNames.join(", ")}`);
  }

  if (parsed.roleNames && parsed.roleNames.length > 0) {
    parts.push(`for ${parsed.roleNames.join(", ")}`);
  }

  if (parsed.dayOfWeek !== undefined) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    parts.push(`on ${days[parsed.dayOfWeek]}s`);
  }

  if (parsed.conflictSeverity) {
    parts.push(`(${parsed.conflictSeverity} only)`);
  }

  return parts.join(" ") || "All data";
}
