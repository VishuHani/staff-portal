"use server";

/**
 * AI Service for Staff Availability Reports
 * Integrates with OpenAI query parser for natural language processing
 * NOW WITH REAL DATABASE QUERIES!
 * 
 * ENHANCED: Conversation context memory, OpenAI-powered intent detection,
 * pronoun resolution, and entity tracking for follow-up questions.
 */

import { parseQuery, describeQuery, resolveVenueNames, resolveRoleNames, resolveUserNames } from "@/lib/ai/query-parser";
import { prisma } from "@/lib/prisma";
import { format, addDays, startOfDay, endOfDay, isWeekend, eachDayOfInterval, getDay, parseISO, isValid } from "date-fns";
import { requireAuth } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import OpenAI from "openai";

// ============================================
// CONVERSATION CONTEXT TYPES
// ============================================

export interface MentionedEntity {
  id: string;
  name: string;
  type: "staff" | "venue" | "date";
  mentionedAt: Date;
}

export interface ConversationContext {
  mentionedStaff: MentionedEntity[];
  mentionedVenues: MentionedEntity[];
  mentionedDates: MentionedEntity[];
  lastQueryIntent: string | null;
  lastQueryResult: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIQueryContext {
  venueId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  availabilityData?: any;
  // NEW: Conversation history for context
  conversationHistory?: ChatMessage[];
  // NEW: Current conversation context
  currentContext?: ConversationContext;
}

interface AIResponse {
  success: boolean;
  answer?: string;
  suggestions?: string[];
  error?: string;
  isDemo?: boolean;
  parsedQuery?: any;
  // NEW: Updated context to return to client
  updatedContext?: ConversationContext;
}

// ============================================
// INTENT DETECTION WITH OPENAI
// ============================================

const INTENT_SCHEMA = {
  type: "object" as const,
  properties: {
    intent: {
      type: "string" as const,
      enum: [
        "staff_lookup",
        "availability_query",
        "coverage_analysis",
        "timeoff_query",
        "conflict_detection",
        "staff_patterns",
        "weekend_coverage",
        "staff_availability",
        "follow_up",
        "general_help",
        "specific_staff_availability"
      ]
    },
    entities: {
      type: "object" as const,
      properties: {
        staffNames: { type: "array" as const, items: { type: "string" as const } },
        dateReferences: { type: "array" as const, items: { type: "string" as const } },
        venueNames: { type: "array" as const, items: { type: "string" as const } },
        pronouns: { type: "array" as const, items: { type: "string" as const } }
      }
    },
    action: {
      type: "string" as const,
      enum: ["view", "approve", "reject", "assign", "compare", null]
    },
    resolvedQuery: {
      type: "string" as const,
      description: "The query with pronouns resolved to actual names"
    },
    confidence: { type: "number" as const }
  },
  required: ["intent", "confidence"]
};

async function detectIntentWithAI(
  query: string,
  conversationHistory: ChatMessage[],
  context: ConversationContext
): Promise<{
  intent: string;
  entities: {
    staffNames?: string[];
    dateReferences?: string[];
    venueNames?: string[];
    pronouns?: string[];
  };
  resolvedQuery: string;
  confidence: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback to keyword matching
    return detectIntentWithKeywords(query, context);
  }

  try {
    const openai = new OpenAI({ apiKey });
    
    // Build context summary for the AI
    const contextSummary = buildContextSummary(context);
    
    // Build conversation history summary
    const historySummary = conversationHistory
      .slice(-6) // Last 6 messages for context
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an intent detection system for a staff management application.
Analyze the user's query and extract structured information.

Current conversation context:
${contextSummary}

Recent conversation:
${historySummary}

IMPORTANT: If the user uses pronouns like "her", "his", "their", "she", "he", "they", resolve them to the actual staff member name from the context.
For example, if context shows "Isabella" was mentioned and user asks "What is her availability?", resolve to "What is Isabella's availability?"

Return a JSON object with:
- intent: One of the predefined intents
- entities: Extracted names, dates, venues
- resolvedQuery: Query with pronouns resolved
- confidence: 0-1 score`
        },
        {
          role: "user",
          content: query
        }
      ],
      functions: [
        {
          name: "detect_intent",
          parameters: INTENT_SCHEMA
        }
      ],
      function_call: { name: "detect_intent" },
      temperature: 0.1
    });

    const functionCall = response.choices[0]?.message?.function_call;
    if (functionCall?.arguments) {
      const parsed = JSON.parse(functionCall.arguments);
      return {
        intent: parsed.intent || "general_help",
        entities: parsed.entities || {},
        resolvedQuery: parsed.resolvedQuery || query,
        confidence: parsed.confidence || 0.8
      };
    }
  } catch (error) {
    console.error("OpenAI intent detection failed:", error);
  }

  return detectIntentWithKeywords(query, context);
}

function detectIntentWithKeywords(
  query: string,
  context: ConversationContext
): {
  intent: string;
  entities: {
    staffNames?: string[];
    dateReferences?: string[];
    venueNames?: string[];
    pronouns?: string[];
  };
  resolvedQuery: string;
  confidence: number;
} {
  const queryLower = query.toLowerCase();
  let resolvedQuery = query;
  
  // Extract pronouns
  const pronouns = ["her", "his", "their", "she", "he", "they", "him"];
  const foundPronouns: string[] = [];
  
  for (const pronoun of pronouns) {
    if (queryLower.includes(pronoun)) {
      foundPronouns.push(pronoun);
      // Resolve pronoun to last mentioned staff
      if (context.mentionedStaff.length > 0) {
        const lastStaff = context.mentionedStaff[context.mentionedStaff.length - 1];
        resolvedQuery = resolvedQuery.replace(new RegExp(`\\b${pronoun}\\b`, "gi"), lastStaff.name);
      }
    }
  }
  
  // Extract staff names
  const staffNames: string[] = [];
  const nameMatch = queryLower.match(/(?:who is|what is|email of|phone of|role of|information about|details about|tell me about|availability of|schedule of)\s+([a-zA-Z]+)/i);
  if (nameMatch) {
    staffNames.push(nameMatch[1]);
  }
  
  // Extract date references
  const dateReferences: string[] = [];
  if (queryLower.includes("today")) dateReferences.push("today");
  if (queryLower.includes("tomorrow")) dateReferences.push("tomorrow");
  if (queryLower.includes("next week")) dateReferences.push("next week");
  if (queryLower.includes("this week")) dateReferences.push("this week");
  if (queryLower.includes("weekend")) dateReferences.push("weekend");
  
  // Determine intent
  let intent = "general_help";
  
  if (queryLower.includes("who is") || queryLower.includes("information about") || queryLower.includes("details about")) {
    intent = "staff_lookup";
  } else if (queryLower.includes("available") || queryLower.includes("working") || queryLower.includes("availability") || queryLower.includes("schedule")) {
    intent = "availability_query";
  } else if (queryLower.includes("coverage") || queryLower.includes("staffing level")) {
    intent = "coverage_analysis";
  } else if (queryLower.includes("time off") || queryLower.includes("time-off") || queryLower.includes("leave") || queryLower.includes("vacation") || queryLower.includes("pto")) {
    intent = "timeoff_query";
  } else if (queryLower.includes("conflict") || queryLower.includes("gap") || queryLower.includes("problem")) {
    intent = "conflict_detection";
  } else if (queryLower.includes("pattern") || queryLower.includes("most") || queryLower.includes("least") || queryLower.includes("frequently")) {
    intent = "staff_patterns";
  } else if (queryLower.includes("weekend") || queryLower.includes("saturday") || queryLower.includes("sunday")) {
    intent = "weekend_coverage";
  } else if (foundPronouns.length > 0 && context.mentionedStaff.length > 0) {
    intent = "follow_up";
  }
  
  return {
    intent,
    entities: {
      staffNames,
      dateReferences,
      pronouns: foundPronouns
    },
    resolvedQuery,
    confidence: 0.7
  };
}

function buildContextSummary(context: ConversationContext): string {
  const parts: string[] = [];
  
  if (context.mentionedStaff.length > 0) {
    const staff = context.mentionedStaff.map(s => s.name).join(", ");
    parts.push(`Recently mentioned staff: ${staff}`);
  }
  
  if (context.mentionedVenues.length > 0) {
    const venues = context.mentionedVenues.map(v => v.name).join(", ");
    parts.push(`Recently mentioned venues: ${venues}`);
  }
  
  if (context.mentionedDates.length > 0) {
    const dates = context.mentionedDates.map(d => d.name).join(", ");
    parts.push(`Recently mentioned dates: ${dates}`);
  }
  
  if (context.lastQueryIntent) {
    parts.push(`Last query intent: ${context.lastQueryIntent}`);
  }
  
  return parts.length > 0 ? parts.join("\n") : "No previous context";
}

function updateContext(
  context: ConversationContext,
  intent: string,
  entities: {
    staffNames?: string[];
    dateReferences?: string[];
    venueNames?: string[];
  },
  result: any
): ConversationContext {
  const newContext: ConversationContext = {
    mentionedStaff: [...context.mentionedStaff],
    mentionedVenues: [...context.mentionedVenues],
    mentionedDates: [...context.mentionedDates],
    lastQueryIntent: intent,
    lastQueryResult: result
  };
  
  // Add newly mentioned staff
  if (entities.staffNames) {
    for (const name of entities.staffNames) {
      // Check if already mentioned
      if (!newContext.mentionedStaff.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        newContext.mentionedStaff.push({
          id: `temp-${Date.now()}`,
          name: name,
          type: "staff",
          mentionedAt: new Date()
        });
      }
    }
  }
  
  // Add staff found in results
  if (result?.staffFound) {
    for (const staff of result.staffFound) {
      const name = `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
      if (name && !newContext.mentionedStaff.some(s => s.id === staff.id)) {
        newContext.mentionedStaff.push({
          id: staff.id,
          name: name,
          type: "staff",
          mentionedAt: new Date()
        });
      }
    }
  }
  
  // Add date references
  if (entities.dateReferences) {
    for (const dateRef of entities.dateReferences) {
      if (!newContext.mentionedDates.some(d => d.name === dateRef)) {
        newContext.mentionedDates.push({
          id: `date-${Date.now()}`,
          name: dateRef,
          type: "date",
          mentionedAt: new Date()
        });
      }
    }
  }
  
  // Keep only last 5 mentioned entities per type
  newContext.mentionedStaff = newContext.mentionedStaff.slice(-5);
  newContext.mentionedVenues = newContext.mentionedVenues.slice(-5);
  newContext.mentionedDates = newContext.mentionedDates.slice(-5);
  
  return newContext;
}

// ============================================
// INITIAL CONTEXT
// ============================================

export async function createInitialContext(): Promise<ConversationContext> {
  return {
    mentionedStaff: [],
    mentionedVenues: [],
    mentionedDates: [],
    lastQueryIntent: null,
    lastQueryResult: null
  };
}

// ============================================
// DATABASE QUERY FUNCTIONS FOR REAL DATA
// ============================================

/**
 * Get staff available on a specific date
 */
async function getStaffAvailableOnDate(date: Date, sharedVenueUserIds: string[]) {
  const dayOfWeek = getDay(date);

  // Get all staff with availability on this day
  const staffWithAvailability = await prisma.user.findMany({
    where: {
      id: { in: sharedVenueUserIds },
      active: true,
      availability: {
        some: {
          dayOfWeek,
          isAvailable: true,
        },
      },
    },
    include: {
      availability: {
        where: { dayOfWeek, isAvailable: true },
      },
      role: { select: { name: true } },
    },
  });

  // Filter out those on time-off
  const timeOffRequests = await prisma.timeOffRequest.findMany({
    where: {
      userId: { in: sharedVenueUserIds },
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { userId: true },
  });

  const onTimeOffIds = new Set(timeOffRequests.map(t => t.userId));

  return staffWithAvailability.filter(staff => !onTimeOffIds.has(staff.id));
}

/**
 * Get coverage stats for a date range
 */
async function getCoverageStats(startDate: Date, endDate: Date, sharedVenueUserIds: string[]) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  const totalStaff = sharedVenueUserIds.length;

  const dailyStats = [];
  let totalAvailable = 0;
  let lowCoverageDays: { date: Date; available: number; percentage: number }[] = [];

  for (const date of dates) {
    const dayOfWeek = getDay(date);

    // Count available
    const available = await prisma.availability.count({
      where: {
        userId: { in: sharedVenueUserIds },
        dayOfWeek,
        isAvailable: true,
      },
    });

    // Count on time-off
    const onTimeOff = await prisma.timeOffRequest.count({
      where: {
        userId: { in: sharedVenueUserIds },
        status: "APPROVED",
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    const netAvailable = Math.max(0, available - onTimeOff);
    const percentage = totalStaff > 0 ? Math.round((netAvailable / totalStaff) * 100) : 0;

    totalAvailable += netAvailable;

    dailyStats.push({
      date,
      dayName: format(date, "EEEE"),
      dateStr: format(date, "MMM d"),
      available: netAvailable,
      percentage,
      isWeekend: isWeekend(date),
    });

    if (percentage < 50) {
      lowCoverageDays.push({ date, available: netAvailable, percentage });
    }
  }

  const avgCoverage = dates.length > 0
    ? Math.round((totalAvailable / (dates.length * totalStaff)) * 100)
    : 0;

  return {
    dailyStats,
    avgCoverage,
    lowCoverageDays,
    totalDays: dates.length,
    totalStaff,
  };
}

/**
 * Get pending and upcoming time-off requests
 */
async function getTimeOffData(sharedVenueUserIds: string[], startDate: Date, endDate: Date) {
  const requests = await prisma.timeOffRequest.findMany({
    where: {
      userId: { in: sharedVenueUserIds },
      OR: [
        { status: "PENDING" },
        {
          status: "APPROVED",
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const pending = requests.filter(r => r.status === "PENDING");
  const approved = requests.filter(r => r.status === "APPROVED");

  return { pending, approved, total: requests.length };
}

/**
 * Get scheduling conflicts (days with very low or no coverage)
 */
async function getConflicts(startDate: Date, endDate: Date, sharedVenueUserIds: string[]) {
  const stats = await getCoverageStats(startDate, endDate, sharedVenueUserIds);

  const critical = stats.dailyStats.filter(d => d.percentage === 0);
  const warning = stats.dailyStats.filter(d => d.percentage > 0 && d.percentage < 30);
  const caution = stats.dailyStats.filter(d => d.percentage >= 30 && d.percentage < 50);

  return { critical, warning, caution, totalConflicts: critical.length + warning.length };
}

/**
 * Get staff working patterns (who works most, least, etc.)
 */
async function getStaffPatterns(sharedVenueUserIds: string[]) {
  const staffWithAvailability = await prisma.user.findMany({
    where: {
      id: { in: sharedVenueUserIds },
      active: true,
    },
    include: {
      availability: {
        where: { isAvailable: true },
      },
      role: { select: { name: true } },
    },
  });

  const patterns = staffWithAvailability.map(staff => ({
    id: staff.id,
    name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email,
    role: staff.role.name,
    daysAvailable: staff.availability.length,
    availableDays: staff.availability.map(a => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[a.dayOfWeek];
    }),
  }));

  // Sort by availability
  patterns.sort((a, b) => b.daysAvailable - a.daysAvailable);

  return patterns;
}

/**
 * Process a natural language query about staff availability
 * Uses AI query parser to convert natural language to structured filters
 * NOW QUERIES REAL DATABASE DATA!
 * 
 * ENHANCED: Now supports conversation context for follow-up questions
 */
export async function processAIQuery(
  query: string,
  context?: AIQueryContext
): Promise<AIResponse> {
  try {
    // Get current user for data scoping
    const user = await requireAuth();

    // Initialize or use existing conversation context
    const conversationContext: ConversationContext = context?.currentContext || await createInitialContext();
    const conversationHistory: ChatMessage[] = context?.conversationHistory || [];

    // Detect intent with AI (or fallback to keywords)
    const intentResult = await detectIntentWithAI(query, conversationHistory, conversationContext);
    const { intent, entities, resolvedQuery, confidence } = intentResult;

    console.log(`[AI] Intent: ${intent}, Resolved: "${resolvedQuery}", Confidence: ${confidence}`);

    // Store resolved query for processing
    const parsed: any = {
      originalQuery: query,
      resolvedQuery: resolvedQuery,
      intent: intent,
      entities: entities,
      dateRange: context?.dateRange,
    };

    // Try to use OpenAI for advanced parsing if available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const aiParsed = await parseQuery(resolvedQuery); // Use resolved query
        Object.assign(parsed, aiParsed);

        // Resolve names to IDs
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
      } catch (parseError) {
        console.log("OpenAI parsing failed, using keyword matching:", parseError);
      }
    }

    // Generate description for debugging
    const description = apiKey ? describeQuery(parsed) : resolvedQuery;

    // Generate answer with REAL DATABASE DATA
    const result = await generateQueryAnswer(parsed, description, user.id, conversationContext);

    // Update context with new information
    const updatedContext = updateContext(conversationContext, intent, entities, result);

    return {
      success: true,
      answer: result.answer,
      suggestions: generateSmartSuggestions(parsed),
      parsedQuery: parsed,
      isDemo: false,
      updatedContext,
    };
  } catch (error) {
    console.error("AI query error:", error);
    // Return helpful error message
    return {
      success: false,
      error: "Failed to process your query. Please try again or rephrase your question.",
    };
  }
}

/**
 * Generate an answer based on parsed query - NOW WITH REAL DATA!
 * ENHANCED: Returns both answer and staff found for context tracking
 */
async function generateQueryAnswer(
  parsed: any,
  description: string,
  userId: string,
  conversationContext?: ConversationContext
): Promise<{ answer: string; staffFound?: any[] }> {
  // Get shared venue users for this manager
  const sharedVenueUserIds = await getSharedVenueUsers(userId);

  if (sharedVenueUserIds.length === 0) {
    return { answer: "I couldn't find any team members in your venues. Please ensure you're assigned to a venue with staff." };
  }

  // Default date range: today to 7 days from now
  const startDate = parsed.dateRange?.start || new Date();
  const endDate = parsed.dateRange?.end || addDays(new Date(), 7);

  let answer = "";
  let staffFound: any[] = [];

  // Use resolved query if available (for pronoun resolution)
  const queryLower = (parsed.resolvedQuery || parsed.originalQuery || description).toLowerCase();

  // ==========================================
  // AVAILABILITY QUERIES - "Who is available?" or "What is [name]'s availability?"
  // ==========================================
  if ((queryLower.includes("who") && (queryLower.includes("available") || queryLower.includes("working"))) || 
      queryLower.includes("availability") || queryLower.includes("schedule")) {
    
    // Extract staff name from query if asking about specific person
    let targetStaffId: string | null = null;
    const nameMatch = queryLower.match(/(?:what is|show me|tell me about)\s+([a-zA-Z]+)'s\s+(?:availability|schedule)/i);
    
    if (nameMatch) {
      const searchName = nameMatch[1].toLowerCase();
      // Look for staff in context first
      const contextStaff = conversationContext?.mentionedStaff.find(s => 
        s.name.toLowerCase().includes(searchName)
      );
      
      if (contextStaff) {
        targetStaffId = contextStaff.id;
      } else {
        // Fall back to database search
        const staff = await prisma.user.findFirst({
          where: {
            id: { in: sharedVenueUserIds },
            OR: [
              { firstName: { equals: searchName, mode: 'insensitive' } },
              { lastName: { equals: searchName, mode: 'insensitive' } },
              { firstName: { contains: searchName, mode: 'insensitive' } },
              { lastName: { contains: searchName, mode: 'insensitive' } },
            ],
          },
        });
        
        if (staff) {
          targetStaffId = staff.id;
          // Add to context for future reference
          staffFound.push({
            id: staff.id,
            firstName: staff.firstName,
            lastName: staff.lastName,
            email: staff.email
          });
        }
      }
    }
    
    // Check if asking about specific day
    const targetDate = parsed.specificDate || (queryLower.includes("tomorrow")
      ? addDays(new Date(), 1)
      : queryLower.includes("today")
        ? new Date()
        : startDate);

    let availableStaff;
    if (targetStaffId) {
      // Get availability for specific staff member
      const staffWithAvailability = await prisma.user.findMany({
        where: {
          id: targetStaffId,
          active: true,
        },
        include: {
          availability: {
            where: { 
              dayOfWeek: getDay(targetDate), 
              isAvailable: true 
            },
          },
          role: { select: { name: true } },
        },
      });
      
      // Filter out those on time-off
      const timeOffRequests = await prisma.timeOffRequest.findMany({
        where: {
          userId: targetStaffId,
          status: "APPROVED",
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
        select: { userId: true },
      });
      
      const onTimeOffIds = new Set(timeOffRequests.map(t => t.userId));
      availableStaff = staffWithAvailability.filter(staff => !onTimeOffIds.has(staff.id));
    } else {
      // Get all available staff (original behavior)
      availableStaff = await getStaffAvailableOnDate(targetDate, sharedVenueUserIds);
    }
    
    const dateStr = format(targetDate, "EEEE, MMMM d");

    if (availableStaff.length === 0) {
      if (targetStaffId) {
        // Check if specific staff is on time-off
        const timeOffRequests = await prisma.timeOffRequest.findMany({
          where: {
            userId: targetStaffId,
            status: "APPROVED",
            startDate: { lte: targetDate },
            endDate: { gte: targetDate },
          },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        
        const staff = await prisma.user.findUnique({
          where: { id: targetStaffId },
          select: { firstName: true, lastName: true }
        });
        
        const fullName = staff ? `${staff.firstName || ''} ${staff.lastName || ''}`.trim() : 'This staff member';
        
        if (timeOffRequests.length > 0) {
          answer = `**${fullName}'s Availability on ${dateStr}**\n\n`;
          answer += `${fullName} is on approved time-off on this day.`;
        } else {
          answer = `**${fullName}'s Availability on ${dateStr}**\n\n`;
          answer += `${fullName} is not available on this day.`;
        }
      } else {
        answer = `**Staff Available on ${dateStr}**\n\n`;
        answer += `No staff members are available on this day.\n\n`;
        answer += `**Recommendation:** Consider reaching out to staff for backup coverage or reviewing time-off requests.`;
      }
    } else {
      if (targetStaffId) {
        const staff = availableStaff[0];
        const fullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email;
        const avail = staff.availability[0];
        const timeInfo = avail?.isAllDay
          ? "All Day"
          : avail?.startTime && avail?.endTime
            ? `${avail.startTime} - ${avail.endTime}`
            : "Available";
            
        answer = `**${fullName}'s Availability on ${dateStr}**\n\n`;
        answer += `${fullName} is **available** on this day: ${timeInfo}`;
      } else {
        answer = `**Staff Available on ${dateStr}**\n\n`;
        answer += `**${availableStaff.length} staff member${availableStaff.length > 1 ? 's' : ''} available:**\n\n`;

        availableStaff.slice(0, 10).forEach((staff, idx) => {
          const name = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email;
          const avail = staff.availability[0];
          const timeInfo = avail?.isAllDay
            ? "All Day"
            : avail?.startTime && avail?.endTime
              ? `${avail.startTime} - ${avail.endTime}`
              : "Available";
          answer += `${idx + 1}. **${name}** (${staff.role.name}) - ${timeInfo}\n`;
        });

        if (availableStaff.length > 10) {
          answer += `\n...and ${availableStaff.length - 10} more staff members.`;
        }

        const coveragePercent = Math.round((availableStaff.length / sharedVenueUserIds.length) * 100);
        answer += `\n\n**Coverage:** ${coveragePercent}% (${availableStaff.length}/${sharedVenueUserIds.length} staff)`;
      }
    }
  }
  // ==========================================
  // COVERAGE QUERIES - "Show me coverage"
  // ==========================================
  else if (queryLower.includes("coverage") || queryLower.includes("staffing level")) {
    const stats = await getCoverageStats(startDate, endDate, sharedVenueUserIds);

    answer = `**Coverage Analysis: ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}**\n\n`;
    answer += `**Overall Statistics:**\n`;
    answer += `- Average Coverage: **${stats.avgCoverage}%**\n`;
    answer += `- Days Analyzed: ${stats.totalDays}\n`;
    answer += `- Total Staff: ${stats.totalStaff}\n\n`;

    if (stats.lowCoverageDays.length > 0) {
      answer += `**Days with Low Coverage (<50%):**\n`;
      stats.lowCoverageDays.slice(0, 5).forEach(day => {
        const dateStr = format(day.date, "EEE, MMM d");
        const emoji = day.percentage === 0 ? "🔴" : day.percentage < 30 ? "🟠" : "🟡";
        answer += `- ${emoji} ${dateStr}: ${day.percentage}% (${day.available} staff)\n`;
      });

      if (stats.lowCoverageDays.length > 5) {
        answer += `- ...and ${stats.lowCoverageDays.length - 5} more days\n`;
      }
    } else {
      answer += `**All days have adequate coverage (≥50%).**\n`;
    }

    answer += `\n**Daily Breakdown (Next 7 days):**\n`;
    stats.dailyStats.slice(0, 7).forEach(day => {
      const bar = "█".repeat(Math.round(day.percentage / 10)) + "░".repeat(10 - Math.round(day.percentage / 10));
      answer += `${day.dateStr} (${day.dayName.slice(0, 3)}): ${bar} ${day.percentage}%\n`;
    });
  }
  // ==========================================
  // CONFLICTS QUERIES - "Show conflicts/gaps"
  // ==========================================
  else if (queryLower.includes("conflict") || queryLower.includes("gap") || queryLower.includes("problem")) {
    const conflicts = await getConflicts(startDate, endDate, sharedVenueUserIds);

    answer = `**Scheduling Conflicts: ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}**\n\n`;

    if (conflicts.totalConflicts === 0 && conflicts.caution.length === 0) {
      answer += `**Great news!** No scheduling conflicts found in this period.\n\n`;
      answer += `All days have adequate staffing coverage.`;
    } else {
      answer += `**Summary:** ${conflicts.totalConflicts} critical/warning days found\n\n`;

      if (conflicts.critical.length > 0) {
        answer += `**🔴 Critical (No Coverage):**\n`;
        conflicts.critical.forEach(day => {
          answer += `- ${day.dateStr} (${day.dayName}) - **0% coverage**\n`;
        });
        answer += `\n`;
      }

      if (conflicts.warning.length > 0) {
        answer += `**🟠 Warning (<30% Coverage):**\n`;
        conflicts.warning.forEach(day => {
          answer += `- ${day.dateStr} (${day.dayName}) - ${day.percentage}% (${day.available} staff)\n`;
        });
        answer += `\n`;
      }

      if (conflicts.caution.length > 0) {
        answer += `**🟡 Caution (30-50% Coverage):**\n`;
        conflicts.caution.slice(0, 3).forEach(day => {
          answer += `- ${day.dateStr} (${day.dayName}) - ${day.percentage}%\n`;
        });
        if (conflicts.caution.length > 3) {
          answer += `- ...and ${conflicts.caution.length - 3} more\n`;
        }
      }

      answer += `\n**Recommended Actions:**\n`;
      answer += `1. Contact available staff about covering critical days\n`;
      answer += `2. Review pending time-off requests\n`;
      answer += `3. Consider hiring temporary staff if needed`;
    }
  }
  // ==========================================
  // TIME-OFF QUERIES - "Who has time off?"
  // ==========================================
  else if (queryLower.includes("time off") || queryLower.includes("time-off") || queryLower.includes("leave") || queryLower.includes("vacation") || queryLower.includes("pto")) {
    const timeOff = await getTimeOffData(sharedVenueUserIds, startDate, endDate);

    answer = `**Time-Off Requests: ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}**\n\n`;

    if (timeOff.pending.length > 0) {
      answer += `**⏳ Pending Approval (${timeOff.pending.length}):**\n`;
      timeOff.pending.slice(0, 5).forEach(req => {
        const name = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        answer += `- **${name}**: ${format(req.startDate, "MMM d")} - ${format(req.endDate, "MMM d")} (${req.reason || 'No reason'})\n`;
      });
      if (timeOff.pending.length > 5) {
        answer += `- ...and ${timeOff.pending.length - 5} more pending\n`;
      }
      answer += `\n`;
    }

    if (timeOff.approved.length > 0) {
      answer += `**✅ Approved Time-Off (${timeOff.approved.length}):**\n`;
      timeOff.approved.slice(0, 5).forEach(req => {
        const name = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        answer += `- **${name}**: ${format(req.startDate, "MMM d")} - ${format(req.endDate, "MMM d")}\n`;
      });
      if (timeOff.approved.length > 5) {
        answer += `- ...and ${timeOff.approved.length - 5} more approved\n`;
      }
    }

    if (timeOff.total === 0) {
      answer += `No time-off requests found for this period.`;
    }
  }
  // ==========================================
  // STAFF PATTERNS - "Who works most?"
  // ==========================================
  else if (queryLower.includes("pattern") || queryLower.includes("most") || queryLower.includes("least") || queryLower.includes("frequently")) {
    const patterns = await getStaffPatterns(sharedVenueUserIds);

    answer = `**Staff Availability Patterns**\n\n`;
    answer += `**Most Available Staff:**\n`;
    patterns.slice(0, 5).forEach((staff, idx) => {
      answer += `${idx + 1}. **${staff.name}** (${staff.role}) - ${staff.daysAvailable} days/week\n`;
      answer += `   Days: ${staff.availableDays.join(", ")}\n`;
    });

    if (patterns.length > 5) {
      const leastAvailable = patterns.slice(-3).reverse();
      answer += `\n**Least Available Staff:**\n`;
      leastAvailable.forEach((staff, idx) => {
        answer += `${idx + 1}. **${staff.name}** (${staff.role}) - ${staff.daysAvailable} days/week\n`;
      });
    }

    const avgDays = patterns.reduce((sum, p) => sum + p.daysAvailable, 0) / patterns.length;
    answer += `\n**Average Availability:** ${avgDays.toFixed(1)} days/week per staff member`;
  }
  // ==========================================
  // WEEKEND QUERIES - "Weekend coverage"
  // ==========================================
  else if (queryLower.includes("weekend") || queryLower.includes("saturday") || queryLower.includes("sunday")) {
    const stats = await getCoverageStats(startDate, endDate, sharedVenueUserIds);
    const weekendDays = stats.dailyStats.filter(d => d.isWeekend);

    answer = `**Weekend Coverage Analysis**\n\n`;

    if (weekendDays.length === 0) {
      answer += `No weekends found in the selected date range.`;
    } else {
      const avgWeekendCoverage = Math.round(
        weekendDays.reduce((sum, d) => sum + d.percentage, 0) / weekendDays.length
      );

      answer += `**Average Weekend Coverage:** ${avgWeekendCoverage}%\n\n`;
      answer += `**Weekend Breakdown:**\n`;

      weekendDays.forEach(day => {
        const emoji = day.percentage >= 70 ? "✅" : day.percentage >= 50 ? "🟡" : "🔴";
        answer += `- ${emoji} ${day.dateStr} (${day.dayName}): ${day.percentage}% (${day.available} staff)\n`;
      });

      if (avgWeekendCoverage < 50) {
        answer += `\n**⚠️ Weekend coverage is below target.** Consider:\n`;
        answer += `- Offering weekend shift incentives\n`;
        answer += `- Rotating weekend responsibilities\n`;
        answer += `- Hiring weekend-specific staff`;
      }
    }
  }
  // ==========================================
  // STAFF LOOKUP QUERIES - "Who is Isabella?" / "What is Isabella's last name?"
  // ==========================================
  else if (queryLower.includes("who is") || queryLower.includes("last name") || queryLower.includes("first name") || 
           queryLower.includes("email of") || queryLower.includes("phone of") || queryLower.includes("role of") ||
           queryLower.includes("information about") || queryLower.includes("details about") ||
           queryLower.includes("tell me about") || queryLower.match(/what is \w+'s (last|first )?name/)) {
    
    // Extract name from query
    const nameMatch = queryLower.match(/(?:who is|what is|email of|phone of|role of|information about|details about|tell me about)\s+([a-zA-Z]+)/i) ||
                      queryLower.match(/([a-zA-Z]+)'s (last|first )?name/i);
    
    if (nameMatch) {
      const searchName = nameMatch[1].toLowerCase();
      
      // Search for staff by first name, last name, or email
      const staff = await prisma.user.findFirst({
        where: {
          id: { in: sharedVenueUserIds },
          OR: [
            { firstName: { equals: searchName, mode: 'insensitive' } },
            { lastName: { equals: searchName, mode: 'insensitive' } },
            { firstName: { contains: searchName, mode: 'insensitive' } },
            { lastName: { contains: searchName, mode: 'insensitive' } },
            { email: { contains: searchName, mode: 'insensitive' } },
          ],
        },
        include: {
          role: { select: { name: true } },
          venues: {
            include: {
              venue: { select: { name: true, code: true } },
            },
          },
          availability: {
            where: { isAvailable: true },
          },
        },
      });

      if (staff) {
        const fullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email;
        const venueNames = staff.venues.map(v => v.venue.name).join(", ") || "No venue assigned";
        const daysAvailable = staff.availability.length;
        
        // Track found staff for context
        staffFound.push({
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email
        });
        
        answer = `**Staff Information: ${fullName}**\n\n`;
        answer += `**Details:**\n`;
        answer += `- **First Name:** ${staff.firstName || 'Not set'}\n`;
        answer += `- **Last Name:** ${staff.lastName || 'Not set'}\n`;
        answer += `- **Email:** ${staff.email}\n`;
        answer += `- **Role:** ${staff.role?.name || 'Unknown'}\n`;
        answer += `- **Venue(s):** ${venueNames}\n`;
        answer += `- **Status:** ${staff.active ? '✅ Active' : '❌ Inactive'}\n`;
        answer += `- **Availability:** ${daysAvailable} days/week\n`;
        
        if (staff.phone) {
          answer += `- **Phone:** ${staff.phone}\n`;
        }
        
        answer += `\n**Quick Actions:**\n`;
        answer += `- View their availability in the Availability Matrix\n`;
        answer += `- Check their time-off requests`;
      } else {
        answer = `I couldn't find a staff member named "${searchName}" in your team.\n\n`;
        answer += `**Suggestions:**\n`;
        answer += `- Check the spelling of the name\n`;
        answer += `- Try searching by email instead\n`;
        answer += `- Use "Show me all staff" to see team members`;
      }
    } else {
      // List all staff if no specific name
      const allStaff = await prisma.user.findMany({
        where: {
          id: { in: sharedVenueUserIds },
          active: true,
        },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: { select: { name: true } },
        },
        orderBy: { firstName: 'asc' },
      });

      answer = `**Team Members (${allStaff.length})**\n\n`;
      allStaff.slice(0, 15).forEach((s, idx) => {
        const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
        answer += `${idx + 1}. **${name}** (${s.role.name})\n`;
      });
      
      if (allStaff.length > 15) {
        answer += `\n...and ${allStaff.length - 15} more team members.`;
      }
    }
  }
  // ==========================================
  // DEFAULT - General help with data summary
  // ==========================================
  else {
    // Provide a helpful summary with real data
    const stats = await getCoverageStats(startDate, endDate, sharedVenueUserIds);
    const conflicts = await getConflicts(startDate, endDate, sharedVenueUserIds);
    const timeOff = await getTimeOffData(sharedVenueUserIds, startDate, endDate);

    answer = `**Team Overview: ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}**\n\n`;
    answer += `**Quick Stats:**\n`;
    answer += `- Team Size: ${sharedVenueUserIds.length} staff members\n`;
    answer += `- Average Coverage: ${stats.avgCoverage}%\n`;
    answer += `- Scheduling Conflicts: ${conflicts.totalConflicts} days\n`;
    answer += `- Pending Time-Off Requests: ${timeOff.pending.length}\n\n`;

    answer += `**I can help you with:**\n`;
    answer += `- "Who is available tomorrow?" - See available staff\n`;
    answer += `- "Show me coverage for next week" - Coverage analysis\n`;
    answer += `- "What are the scheduling conflicts?" - Find gaps\n`;
    answer += `- "Who has requested time off?" - Time-off requests\n`;
    answer += `- "Who works most frequently?" - Staff patterns\n`;
    answer += `- "Weekend coverage analysis" - Weekend staffing\n`;
    answer += `- "Who is [name]?" - Staff member lookup`;
  }

  return { answer, staffFound };
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

// Mock response function removed - now using real database queries!

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
