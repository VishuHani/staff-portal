"use server";

/**
 * AI Service for Staff Availability Reports
 * Integrates with OpenAI query parser for natural language processing
 */

import { parseQuery, describeQuery, resolveVenueNames, resolveRoleNames, resolveUserNames } from "@/lib/ai/query-parser";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

interface AIQueryContext {
  venueId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  availabilityData?: any;
}

interface AIResponse {
  success: boolean;
  answer?: string;
  suggestions?: string[];
  error?: string;
  isDemo?: boolean;
  parsedQuery?: any; // Include parsed query for debugging
}

/**
 * Process a natural language query about staff availability
 * Uses AI query parser to convert natural language to structured filters
 */
export async function processAIQuery(
  query: string,
  context?: AIQueryContext
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  // If no API key, return mock response for demonstration
  if (!apiKey) {
    return generateMockResponse(query, context);
  }

  try {
    // Step 1: Parse the query using our AI query parser
    const parsed = await parseQuery(query);

    // Step 2: Resolve names to IDs
    const [venues, roles, users] = await Promise.all([
      prisma.venue.findMany({
        where: { active: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.role.findMany({
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);

    if (parsed.venueNames && parsed.venueNames.length > 0) {
      parsed.venueIds = await resolveVenueNames(parsed.venueNames, venues);
    }

    if (parsed.roleNames && parsed.roleNames.length > 0) {
      parsed.roleIds = await resolveRoleNames(parsed.roleNames, roles);
    }

    if (parsed.userNames && parsed.userNames.length > 0) {
      parsed.userIds = await resolveUserNames(parsed.userNames, users);
    }

    // Step 3: Generate human-friendly description
    const description = describeQuery(parsed);

    // Step 4: Generate answer based on parsed query
    const answer = await generateQueryAnswer(parsed, description);

    return {
      success: true,
      answer,
      suggestions: generateSmartSuggestions(parsed),
      parsedQuery: parsed,
    };
  } catch (error) {
    console.error("AI query error:", error);
    // Fallback to mock response on error
    return generateMockResponse(query, context);
  }
}

/**
 * Generate an answer based on parsed query
 */
async function generateQueryAnswer(parsed: any, description: string): Promise<string> {
  let answer = `I've interpreted your query as: **${description}**\n\n`;

  // Guide user to the appropriate report
  if (parsed.reportType) {
    const reportGuides: Record<string, string> = {
      availability: "To view detailed availability information:\n- Go to **Availability Matrix** for a grid view\n- Filter by day of week, venue, or role\n- See who is available at specific times",
      coverage: "For coverage analysis:\n- Check the **Coverage Analysis** report\n- View staffing levels over time\n- Identify periods needing more staff",
      conflicts: "To review scheduling conflicts:\n- Visit the **Conflicts Report**\n- See critical gaps and understaffing\n- Get suggestions for resolution",
      calendar: "For calendar view:\n- Open the **Calendar View**\n- Toggle between month/week/day views\n- Click days for detailed information",
      matrix: "For matrix view:\n- Use the **Availability Matrix**\n- See all staff availability in one grid\n- Export for scheduling planning",
    };

    answer += reportGuides[parsed.reportType] || "Visit the Reports Dashboard for comprehensive insights.";
  } else {
    answer += "I can help you find the information you need. Here are some options:\n\n";
    answer += "**Available Reports:**\n";
    answer += "- Availability Matrix - Grid view of all staff availability\n";
    answer += "- Coverage Analysis - Staffing levels and trends\n";
    answer += "- Conflicts Report - Scheduling gaps and issues\n";
    answer += "- Calendar View - Daily coverage overview\n\n";
    answer += "Try asking more specific questions like:\n";
    answer += "- \"Show me availability conflicts for next week\"\n";
    answer += "- \"Who is available on Mondays?\"\n";
    answer += "- \"Coverage report for February\"";
  }

  // Add date range info if applicable
  if (parsed.dateRange) {
    const start = format(parsed.dateRange.start, "MMM dd, yyyy");
    const end = format(parsed.dateRange.end, "MMM dd, yyyy");
    answer += `\n\n**Date Range:** ${start} to ${end}`;
  }

  // Add venue info if applicable
  if (parsed.venueNames && parsed.venueNames.length > 0) {
    answer += `\n**Venues:** ${parsed.venueNames.join(", ")}`;
  }

  // Add role info if applicable
  if (parsed.roleNames && parsed.roleNames.length > 0) {
    answer += `\n**Roles:** ${parsed.roleNames.join(", ")}`;
  }

  return answer;
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context?: AIQueryContext): string {
  let prompt = `You are an AI assistant specialized in analyzing staff availability and scheduling data.
You help managers and administrators understand staffing patterns, identify conflicts, and make informed scheduling decisions.

Your responses should be:
- Clear and concise
- Data-driven when possible
- Action-oriented with specific recommendations
- Formatted in markdown when appropriate

`;

  if (context?.dateRange) {
    prompt += `\nCurrent date range: ${context.dateRange.start.toISOString().split('T')[0]} to ${context.dateRange.end.toISOString().split('T')[0]}`;
  }

  if (context?.venueId) {
    prompt += `\nFocusing on venue: ${context.venueId}`;
  }

  if (context?.availabilityData) {
    prompt += `\nAvailability data summary: ${JSON.stringify(context.availabilityData).slice(0, 500)}...`;
  }

  return prompt;
}

/**
 * Generate mock responses for demonstration (when no API key available)
 */
function generateMockResponse(query: string, context?: AIQueryContext): AIResponse {
  const lowerQuery = query.toLowerCase();

  // Pattern matching for common queries
  if (lowerQuery.includes("who") && (lowerQuery.includes("available") || lowerQuery.includes("working"))) {
    return {
      success: true,
      isDemo: true,
      answer: `Based on the current schedule, I can see several staff members available. To get the most accurate information:

1. Check the **Availability Matrix** for a detailed grid view
2. Use the **Calendar View** to see daily coverage
3. Filter by specific dates or venues for precise results

**Demo Mode**: This is a demonstration response. Connect an OpenAI API key to enable real AI-powered insights.`,
      suggestions: [
        "Show me the coverage for next week",
        "Who has requested time off?",
        "What days have the lowest coverage?",
      ],
    };
  }

  if (lowerQuery.includes("coverage") || lowerQuery.includes("staffing")) {
    return {
      success: true,
      isDemo: true,
      answer: `I can help you analyze staffing coverage. Here's what you can do:

**Quick Insights:**
- View the **Coverage Analysis** report for detailed metrics
- Check the **Conflicts Report** for understaffing alerts
- Use date filters to analyze specific periods

**Recommendations:**
- Ensure at least 70% coverage for optimal operations
- Plan ahead for days with multiple time-off requests
- Consider backup staff for critical dates

**Demo Mode**: Connect an OpenAI API key for AI-powered analysis of your actual data.`,
      suggestions: [
        "What's the average coverage this month?",
        "Show me days with low staffing",
        "Analyze coverage trends",
      ],
    };
  }

  if (lowerQuery.includes("conflict") || lowerQuery.includes("gap")) {
    return {
      success: true,
      isDemo: true,
      answer: `To identify scheduling conflicts:

**Check the Conflicts Report** for:
- Days with no staff available (Critical)
- Understaffing situations (Warning)
- Multiple overlapping time-off requests

**Recommended Actions:**
1. Review critical conflicts first
2. Contact affected staff for schedule adjustments
3. Plan contingency coverage
4. Set up alerts for future conflicts

**Demo Mode**: Real AI analysis available with API key configuration.`,
      suggestions: [
        "Show critical conflicts only",
        "What causes most conflicts?",
        "How to prevent scheduling gaps?",
      ],
    };
  }

  // Default response
  return {
    success: true,
    isDemo: true,
    answer: `I'm here to help you with staff availability questions!

**I can assist with:**
- Understanding staffing patterns and coverage
- Identifying scheduling conflicts and gaps
- Analyzing availability trends
- Making scheduling recommendations
- Finding specific staff information

**Quick Tips:**
- Use the reports dashboard for visual insights
- Try specific questions like "Who is available tomorrow?" or "Show me coverage for next week"
- Explore the various report views for different perspectives

**Demo Mode**: This is a demonstration. Add your OpenAI API key to \`.env.local\` for real AI-powered insights:
\`\`\`
OPENAI_API_KEY=your_api_key_here
\`\`\``,
    suggestions: [
      "Who is available this weekend?",
      "Show me coverage analysis",
      "What are the scheduling conflicts?",
    ],
  };
}

/**
 * Generate smart follow-up suggestions based on parsed query
 */
function generateSmartSuggestions(parsed: any): string[] {
  const suggestions: string[] = [];

  // Suggest related report types
  if (parsed.reportType === "conflicts") {
    suggestions.push("Show me the coverage analysis");
    suggestions.push("Who can cover these gaps?");
  } else if (parsed.reportType === "coverage") {
    suggestions.push("Are there any conflicts?");
    suggestions.push("Show me the calendar view");
  } else if (parsed.reportType === "availability") {
    suggestions.push("Show coverage for this period");
    suggestions.push("Are there any scheduling conflicts?");
  }

  // Suggest time-based variations
  if (parsed.dateRange) {
    suggestions.push("Show me next month");
    suggestions.push("Compare with last month");
  } else {
    suggestions.push("Show me next week");
    suggestions.push("What about this weekend?");
  }

  // Suggest venue variations
  if (parsed.venueNames && parsed.venueNames.length > 0) {
    suggestions.push("Show all venues");
  } else {
    suggestions.push("Filter by venue");
  }

  // Return top 3 suggestions
  return suggestions.slice(0, 3);
}

/**
 * Get suggested questions based on context
 */
export async function getSuggestedQuestions(context?: AIQueryContext): Promise<string[]> {
  const baseQuestions = [
    "Who is available tomorrow?",
    "Show me this week's coverage",
    "What are the scheduling conflicts?",
    "Who has requested time off?",
    "What days have low staffing?",
    "Analyze coverage trends",
    "Show me weekend availability",
    "Who works most frequently?",
  ];

  // Add context-specific questions
  if (context?.dateRange) {
    baseQuestions.push("Analyze coverage for the selected period");
  }

  if (context?.venueId) {
    baseQuestions.push("Show staff assigned to this venue");
  }

  return baseQuestions.slice(0, 6);
}
