"use server";

/**
 * AI-Powered Conflict Detection & Resolution
 * Generates intelligent resolution strategies for scheduling conflicts
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { format, parseISO } from "date-fns";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ConflictResolution {
  id: string;
  conflictId: string;
  strategy: string;
  description: string;
  steps: string[];
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: string;
  pros: string[];
  cons: string[];
  confidence: number; // 0-100
  affectedStaff: Array<{
    id: string;
    name: string;
    action: string; // "Contact", "Reassign", "Approve time-off"
  }>;
  requiresApproval: boolean;
}

export interface Conflict {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  date: string;
  dayOfWeek: string;
  title: string;
  description: string;
  venues?: string[];
  details: {
    totalStaff?: number;
    availableStaff?: number;
    coveragePercentage?: number;
    unavailableStaff?: Array<{
      id: string;
      name: string;
      reason: string;
    }>;
    timeOffCount?: number;
    staff?: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
    }>;
  };
}

// ============================================================================
// MAIN AI RESOLUTION GENERATION
// ============================================================================

/**
 * Generate AI-powered resolution strategies for a conflict
 */
export async function generateConflictResolutions(
  conflict: Conflict
): Promise<{ success: boolean; resolutions?: ConflictResolution[]; error?: string }> {
  const user = await requireAuth();

  try {
    // Get context: all staff, their availability, and time-off
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const [allStaff, pendingTimeOff] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { in: sharedVenueUserIds },
          active: true,
        },
        include: {
          availability: {
            where: {
              isAvailable: true,
            },
          },
          timeOffRequests: {
            where: {
              status: { in: ["APPROVED", "PENDING"] },
            },
          },
          role: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.timeOffRequest.findMany({
        where: {
          userId: { in: sharedVenueUserIds },
          status: "PENDING",
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    // Parse conflict date
    const conflictDate = parseISO(conflict.date);
    const dayOfWeek = conflictDate.getDay();

    // Find staff available on this day of week
    const availableStaffOnDay = allStaff.filter((staff) => {
      // Has availability for this day
      const hasAvailability = staff.availability.some((a) => a.dayOfWeek === dayOfWeek);

      // Check if they have time-off on this date
      const hasTimeOff = staff.timeOffRequests.some((tor) => {
        const torStart = new Date(tor.startDate);
        const torEnd = new Date(tor.endDate);
        return conflictDate >= torStart && conflictDate <= torEnd && tor.status === "APPROVED";
      });

      return hasAvailability && !hasTimeOff;
    });

    // Find staff who might be able to adjust
    const potentiallyAvailable = allStaff.filter((staff) => {
      const currentlyMarkedAvailable = availableStaffOnDay.some((s) => s.id === staff.id);
      return !currentlyMarkedAvailable;
    });

    // Prepare context for AI
    const context = prepareConflictContext(
      conflict,
      availableStaffOnDay,
      potentiallyAvailable,
      pendingTimeOff,
      dayOfWeek
    );

    // Generate resolutions with AI
    const resolutions = await generateResolutionsWithAI(conflict, context);

    return {
      success: true,
      resolutions,
    };
  } catch (error) {
    console.error("Error generating conflict resolutions:", error);
    return {
      success: false,
      error: "Failed to generate AI resolutions. Please try again.",
    };
  }
}

/**
 * Prepare context data for AI prompt
 */
function prepareConflictContext(
  conflict: Conflict,
  availableStaff: any[],
  potentiallyAvailable: any[],
  pendingTimeOff: any[],
  dayOfWeek: number
): string {
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];

  const availableStaffList = availableStaff.map((staff) => {
    const availability = staff.availability.find((a: any) => a.dayOfWeek === dayOfWeek);
    return {
      name: `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || staff.email,
      role: staff.role?.name || "Staff",
      shift: availability?.isAllDay
        ? "All day"
        : `${availability?.startTime || "09:00"} - ${availability?.endTime || "17:00"}`,
    };
  });

  const potentialStaffList = potentiallyAvailable.slice(0, 10).map((staff) => {
    const hasAvailabilityOtherDays = staff.availability.length > 0;
    const availableDays = staff.availability.map((a: any) =>
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][a.dayOfWeek]
    ).join(", ");

    return {
      name: `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || staff.email,
      role: staff.role?.name || "Staff",
      currentlyAvailable: hasAvailabilityOtherDays ? `on ${availableDays}` : "No availability set",
      couldAdjust: hasAvailabilityOtherDays,
    };
  });

  const pendingTimeOffList = pendingTimeOff
    .filter((tor) => {
      const torStart = new Date(tor.startDate);
      const torEnd = new Date(tor.endDate);
      const conflictDate = parseISO(conflict.date);
      return conflictDate >= torStart && conflictDate <= torEnd;
    })
    .map((tor) => ({
      name: `${tor.user.firstName || ""} ${tor.user.lastName || ""}`.trim() || tor.user.email,
      startDate: format(new Date(tor.startDate), "MMM d"),
      endDate: format(new Date(tor.endDate), "MMM d"),
    }));

  return `
Conflict Details:
- Date: ${format(parseISO(conflict.date), "EEEE, MMMM d, yyyy")} (${dayName})
- Type: ${conflict.type}
- Severity: ${conflict.severity}
- Current Coverage: ${conflict.details.availableStaff || 0} of ${conflict.details.totalStaff || 0} staff (${conflict.details.coveragePercentage || 0}%)
- Minimum Required: 3 staff members

Available Staff on ${dayName} (${availableStaff.length}):
${availableStaffList.length > 0 ? JSON.stringify(availableStaffList, null, 2) : "None"}

Staff Who Could Potentially Adjust (Top 10):
${potentialStaffList.length > 0 ? JSON.stringify(potentialStaffList, null, 2) : "None"}

Pending Time-Off Requests for this Date:
${pendingTimeOffList.length > 0 ? JSON.stringify(pendingTimeOffList, null, 2) : "None"}

Unavailable Staff:
${conflict.details.unavailableStaff ? JSON.stringify(conflict.details.unavailableStaff.slice(0, 5), null, 2) : "None"}

Business Rules:
- Minimum 3 staff members per day
- 8-hour standard shift (9:00 AM - 5:00 PM)
- Fair distribution of hours across all staff
- Staff can adjust their availability with advance notice
- Managers can approve/deny pending time-off requests
`.trim();
}

/**
 * Generate resolutions using OpenAI GPT-4
 */
async function generateResolutionsWithAI(
  conflict: Conflict,
  context: string
): Promise<ConflictResolution[]> {
  const prompt = `
You are an expert scheduling assistant for a multi-venue staff management system. Analyze the scheduling conflict below and suggest 2-3 practical resolution strategies.

${context}

Task: Generate 2-3 resolution strategies that are:
1. Practical and actionable
2. Specific (name actual staff members from the context)
3. Realistic (consider difficulty and time required)
4. Balanced (show pros and cons)

For each resolution, provide:
- strategy: Clear, concise name (e.g., "Contact Available Staff", "Reassign Shifts", "Approve Pending Time-Off")
- description: Brief explanation (1-2 sentences)
- steps: Array of 3-5 specific action steps
- difficulty: "easy" | "medium" | "hard"
- estimatedTime: Human-readable time (e.g., "10 minutes", "1 hour", "2-3 hours")
- pros: Array of 2-3 advantages
- cons: Array of 1-2 disadvantages
- confidence: Number 0-100 (how likely this will solve the conflict)
- affectedStaff: Array of {name, action} where action is what needs to happen
- requiresApproval: boolean (true if manager approval needed)

Return ONLY a valid JSON array of 2-3 resolutions. Do not include any other text.

Example format:
[
  {
    "strategy": "Contact Available Staff for Extra Coverage",
    "description": "Reach out to staff members who are available on this day to ensure they can work.",
    "steps": [
      "Call or message Sarah Johnson (available Mon)",
      "Confirm her availability and shift times",
      "Update the schedule with her confirmation"
    ],
    "difficulty": "easy",
    "estimatedTime": "15 minutes",
    "pros": [
      "Quick resolution with available staff",
      "No schedule disruptions for other days"
    ],
    "cons": [
      "May require offering incentives or premium pay"
    ],
    "confidence": 85,
    "affectedStaff": [
      {"name": "Sarah Johnson", "action": "Contact to confirm availability"}
    ],
    "requiresApproval": false
  }
]
`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Parse AI response
    const cleanedText = text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const parsedResolutions = JSON.parse(cleanedText);

    // Validate and transform
    if (!Array.isArray(parsedResolutions)) {
      throw new Error("AI response is not an array");
    }

    const resolutions: ConflictResolution[] = parsedResolutions.map((res: any, index: number) => ({
      id: `resolution-${conflict.id}-${index}`,
      conflictId: conflict.id,
      strategy: res.strategy || "Unknown Strategy",
      description: res.description || "",
      steps: Array.isArray(res.steps) ? res.steps : [],
      difficulty: ["easy", "medium", "hard"].includes(res.difficulty) ? res.difficulty : "medium",
      estimatedTime: res.estimatedTime || "Unknown",
      pros: Array.isArray(res.pros) ? res.pros : [],
      cons: Array.isArray(res.cons) ? res.cons : [],
      confidence: typeof res.confidence === "number" ? Math.min(100, Math.max(0, res.confidence)) : 50,
      affectedStaff: Array.isArray(res.affectedStaff) ? res.affectedStaff : [],
      requiresApproval: typeof res.requiresApproval === "boolean" ? res.requiresApproval : false,
    }));

    return resolutions;
  } catch (error) {
    console.error("Error parsing AI response:", error);

    // Fallback: Return rule-based resolutions
    return generateFallbackResolutions(conflict);
  }
}

/**
 * Generate fallback resolutions if AI fails
 */
function generateFallbackResolutions(conflict: Conflict): ConflictResolution[] {
  const resolutions: ConflictResolution[] = [];

  // Resolution 1: Contact available staff
  if (conflict.details.availableStaff && conflict.details.availableStaff > 0) {
    resolutions.push({
      id: `fallback-${conflict.id}-1`,
      conflictId: conflict.id,
      strategy: "Confirm Available Staff Coverage",
      description: "Reach out to currently available staff to confirm they can work on this date.",
      steps: [
        "Review the list of available staff members",
        "Contact each staff member via email or phone",
        "Confirm their availability and shift preferences",
        "Update the schedule with confirmations",
      ],
      difficulty: "easy",
      estimatedTime: "30 minutes",
      pros: [
        "Works with staff who are already available",
        "Quick to implement",
        "No schedule changes needed",
      ],
      cons: [
        "May still have insufficient coverage",
      ],
      confidence: 70,
      affectedStaff: conflict.details.unavailableStaff?.slice(0, 3).map((staff) => ({
        name: staff.name,
        action: "Contact to confirm availability",
      })) || [],
      requiresApproval: false,
    });
  }

  // Resolution 2: Request availability updates
  resolutions.push({
    id: `fallback-${conflict.id}-2`,
    conflictId: conflict.id,
    strategy: "Request Availability Adjustments",
    description: "Ask staff members to update their availability for this day if possible.",
    steps: [
      "Identify staff without availability set for this day",
      "Send bulk notification requesting availability updates",
      "Follow up individually with key staff members",
      "Offer incentives if needed (premium pay, preferred shifts)",
      "Review and approve updated availability",
    ],
    difficulty: "medium",
    estimatedTime: "1-2 hours",
    pros: [
      "Increases overall coverage",
      "Builds better availability data for future",
      "Gives staff flexibility to opt in",
    ],
    cons: [
      "Takes time to coordinate",
      "Not guaranteed to solve issue",
      "May require incentives",
    ],
    confidence: 60,
    affectedStaff: [],
    requiresApproval: true,
  });

  // Resolution 3: Approve pending time-off with coverage plan
  if (conflict.type === "overlappingTimeOff") {
    resolutions.push({
      id: `fallback-${conflict.id}-3`,
      conflictId: conflict.id,
      strategy: "Prioritize Critical Time-Off Requests",
      description: "Approve most critical time-off requests and find coverage for others.",
      steps: [
        "Review all pending time-off requests for this period",
        "Prioritize by urgency and seniority",
        "Approve critical requests",
        "Work with remaining staff to adjust schedules",
      ],
      difficulty: "medium",
      estimatedTime: "1 hour",
      pros: [
        "Balances staff needs with coverage requirements",
        "Shows fairness in approval process",
      ],
      cons: [
        "Some staff may be disappointed",
        "Requires difficult decisions",
      ],
      confidence: 55,
      affectedStaff: [],
      requiresApproval: true,
    });
  }

  return resolutions.slice(0, 2); // Return top 2 fallback resolutions
}

/**
 * Apply a resolution (placeholder for future implementation)
 */
export async function applyConflictResolution(
  resolutionId: string,
  conflictId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await requireAuth();

  try {
    // TODO: Implement actual resolution application logic
    // This would involve:
    // - Creating notifications for affected staff
    // - Updating schedules if applicable
    // - Approving/denying time-off requests
    // - Sending emails to staff members
    // - Creating audit log entries

    console.log("Applying resolution:", { resolutionId, conflictId, userId: user.id });

    return {
      success: true,
      message: "Resolution strategy noted. Manual follow-up required to complete the actions.",
    };
  } catch (error) {
    console.error("Error applying resolution:", error);
    return {
      success: false,
      error: "Failed to apply resolution",
    };
  }
}
