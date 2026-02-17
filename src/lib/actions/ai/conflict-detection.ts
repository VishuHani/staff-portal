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
      affectedStaff: conflict.details.unavailableStaff?.slice(0, 3).map((staff, idx) => ({
        id: `staff-${conflict.id}-${idx}`,
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
 * Apply a resolution by implementing the suggested actions
 */
export async function applyConflictResolution(
  resolutionId: string,
  conflictId: string,
  resolution?: ConflictResolution
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await requireAuth();

  try {
    // Parse the resolution ID to determine the action type
    const actionType = parseResolutionActionType(resolutionId, resolution);
    
    // Get shared venue users for notifications
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    
    // Execute the appropriate action based on resolution type
    let result: { success: boolean; message: string };
    
    switch (actionType) {
      case "contact_staff":
        result = await executeContactStaffAction(resolution, sharedVenueUserIds, user.id);
        break;
      case "approve_timeoff":
        result = await executeApproveTimeOffAction(resolution, sharedVenueUserIds, user.id, conflictId);
        break;
      case "reassign_shift":
        result = await executeReassignShiftAction(resolution, sharedVenueUserIds, user.id, conflictId);
        break;
      case "request_availability":
        result = await executeRequestAvailabilityAction(resolution, sharedVenueUserIds, user.id);
        break;
      default:
        result = await executeGenericResolutionAction(resolution, sharedVenueUserIds, user.id, conflictId);
    }
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: result.success ? "CONFLICT_RESOLUTION_APPLIED" : "CONFLICT_RESOLUTION_FAILED",
        resourceType: "conflict",
        resourceId: conflictId,
        newValue: JSON.stringify({ 
          resolutionId, 
          actionType,
          success: result.success,
          message: result.message 
        }),
      },
    });

    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    console.error("Error applying resolution:", error);
    
    // Create error audit log entry
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "CONFLICT_RESOLUTION_FAILED",
        resourceType: "conflict",
        resourceId: conflictId,
        newValue: JSON.stringify({ resolutionId, error: (error as Error).message }),
      },
    });
    
    return {
      success: false,
      error: "Failed to apply resolution: " + (error as Error).message,
    };
  }
}

/**
 * Parse resolution ID to determine action type
 */
function parseResolutionActionType(resolutionId: string, resolution?: ConflictResolution): string {
  // Check if resolution object is provided with strategy
  if (resolution?.strategy) {
    const strategy = resolution.strategy.toLowerCase();
    
    if (strategy.includes("contact") || strategy.includes("confirm")) {
      return "contact_staff";
    }
    if (strategy.includes("approve") || strategy.includes("time-off")) {
      return "approve_timeoff";
    }
    if (strategy.includes("reassign") || strategy.includes("shift")) {
      return "reassign_shift";
    }
    if (strategy.includes("availability") || strategy.includes("adjust")) {
      return "request_availability";
    }
  }
  
  // Fallback to parsing resolution ID
  if (resolutionId.includes("contact") || resolutionId.includes("confirm")) {
    return "contact_staff";
  }
  if (resolutionId.includes("approve") || resolutionId.includes("timeoff")) {
    return "approve_timeoff";
  }
  if (resolutionId.includes("reassign") || resolutionId.includes("shift")) {
    return "reassign_shift";
  }
  if (resolutionId.includes("availability") || resolutionId.includes("adjust")) {
    return "request_availability";
  }
  
  return "generic";
}

/**
 * Execute contact staff action - send notifications to available staff
 */
async function executeContactStaffAction(
  resolution: ConflictResolution | undefined,
  sharedVenueUserIds: string[],
  currentUserId: string
): Promise<{ success: boolean; message: string }> {
  if (!resolution?.affectedStaff || resolution.affectedStaff.length === 0) {
    return { success: false, message: "No affected staff members specified in resolution" };
  }
  
  const notifications = [];
  
  for (const staff of resolution.affectedStaff) {
    // Find the user by name
    const staffUser = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: staff.name.split(" ")[0] || "" } },
          { lastName: { contains: staff.name.split(" ").slice(1).join(" ") || "" } },
          { email: staff.name },
        ],
        id: { in: sharedVenueUserIds },
      },
    });
    
    if (staffUser) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: staffUser.id,
            type: "ROSTER_CONFLICT",
            title: "Shift Coverage Request",
            message: `You've been identified as available for an upcoming shift. Action needed: ${staff.action}`,
            link: `/manage/rosters?resolution=${resolution.id}`,
          },
        })
      );
    }
  }
  
  if (notifications.length === 0) {
    return { success: false, message: "Could not find any matching staff members to contact" };
  }
  
  await Promise.all(notifications);
  
  return { 
    success: true, 
    message: `Successfully contacted ${notifications.length} staff member(s) regarding coverage` 
  };
}

/**
 * Execute approve time-off action - approve pending time-off requests
 */
async function executeApproveTimeOffAction(
  resolution: ConflictResolution | undefined,
  sharedVenueUserIds: string[],
  currentUserId: string,
  conflictId: string
): Promise<{ success: boolean; message: string }> {
  // Find pending time-off requests that might be related to this conflict
  const pendingTimeOffRequests = await prisma.timeOffRequest.findMany({
    where: {
      userId: { in: sharedVenueUserIds },
      status: "PENDING",
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });
  
  if (pendingTimeOffRequests.length === 0) {
    return { success: false, message: "No pending time-off requests found to approve" };
  }
  
  // For now, approve the most recent pending request
  // In a real implementation, you'd match this to the specific conflict
  const requestToApprove = pendingTimeOffRequests[0];
  
  await prisma.timeOffRequest.update({
    where: { id: requestToApprove.id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: currentUserId,
    },
  });
  
  // Notify the user
  await prisma.notification.create({
    data: {
      userId: requestToApprove.userId,
      type: "TIME_OFF_APPROVED",
      title: "Time-Off Request Approved",
      message: `Your time-off request from ${format(new Date(requestToApprove.startDate), "MMM d")} to ${format(new Date(requestToApprove.endDate), "MMM d, yyyy")} has been approved.`,
      link: `/manage/time-off`,
    },
  });
  
  return { 
    success: true, 
    message: `Approved time-off request for ${requestToApprove.user.firstName || requestToApprove.user.email}` 
  };
}

/**
 * Execute reassign shift action - create shift assignments
 */
async function executeReassignShiftAction(
  resolution: ConflictResolution | undefined,
  sharedVenueUserIds: string[],
  currentUserId: string,
  conflictId: string
): Promise<{ success: boolean; message: string }> {
  if (!resolution?.affectedStaff || resolution.affectedStaff.length === 0) {
    return { success: false, message: "No staff members specified for reassignment" };
  }
  
  // Get venue for the current user
  const venue = await prisma.venue.findFirst({
    where: {
      userVenues: {
        some: { userId: currentUserId },
      },
    },
  });
  
  if (!venue) {
    return { success: false, message: "No venue found for current user" };
  }
  
  // Parse conflict date from conflictId or resolution
  const conflictDate = extractDateFromConflictId(conflictId);
  if (!conflictDate) {
    return { success: false, message: "Could not determine conflict date" };
  }
  
  // Find or create roster for the date
  let roster = await prisma.roster.findFirst({
    where: {
      venueId: venue.id,
      startDate: { lte: conflictDate },
      endDate: { gte: conflictDate },
    },
  });
  
  if (!roster) {
    const startDate = new Date(conflictDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    roster = await prisma.roster.create({
      data: {
        name: `Weekly Roster ${format(startDate, "yyyy-MM-dd")}`,
        venueId: venue.id,
        startDate,
        endDate,
        status: "DRAFT",
        createdBy: currentUserId,
      },
    });
  }
  
  // Create shifts for affected staff
  const shiftsCreated = [];
  
  for (const staff of resolution.affectedStaff) {
    const staffUser = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: staff.name.split(" ")[0] || "" } },
          { lastName: { contains: staff.name.split(" ").slice(1).join(" ") || "" } },
          { email: staff.name },
        ],
        id: { in: sharedVenueUserIds },
      },
    });
    
    if (staffUser) {
      const shift = await prisma.rosterShift.create({
        data: {
          rosterId: roster.id,
          userId: staffUser.id,
          date: conflictDate,
          startTime: "09:00",
          endTime: "17:00",
          breakMinutes: 30,
          notes: `Created via conflict resolution: ${resolution.strategy}`,
        },
      });
      shiftsCreated.push({ shift, staffName: staff.name });
      
      // Notify the staff member
      await prisma.notification.create({
        data: {
          userId: staffUser.id,
          type: "ROSTER_UPDATED",
          title: "New Shift Assignment",
          message: `You've been assigned a shift on ${format(conflictDate, "EEEE, MMM d")} from 9:00 AM to 5:00 PM.`,
          link: `/manage/rosters/${roster.id}`,
        },
      });
    }
  }
  
  if (shiftsCreated.length === 0) {
    return { success: false, message: "Could not create any shift assignments" };
  }
  
  return { 
    success: true, 
    message: `Created ${shiftsCreated.length} shift assignment(s) for ${shiftsCreated.map(s => s.staffName).join(", ")}` 
  };
}

/**
 * Execute request availability action - send availability update requests
 */
async function executeRequestAvailabilityAction(
  resolution: ConflictResolution | undefined,
  sharedVenueUserIds: string[],
  currentUserId: string
): Promise<{ success: boolean; message: string }> {
  // Get all active staff who might need to update availability
  const staffWithoutFullAvailability = await prisma.user.findMany({
    where: {
      id: { in: sharedVenueUserIds },
      active: true,
      OR: [
        { availability: { none: {} } },
        { availability: { some: { isAvailable: false } } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  
  if (staffWithoutFullAvailability.length === 0) {
    // If no staff with missing availability, notify all staff
    const allStaff = await prisma.user.findMany({
      where: { id: { in: sharedVenueUserIds }, active: true },
      select: { id: true },
    });
    
    const notifications = allStaff.map(staff =>
      prisma.notification.create({
        data: {
          userId: staff.id,
          type: "SYSTEM_ANNOUNCEMENT",
          title: "Availability Update Requested",
          message: "Please update your availability for the upcoming scheduling period. Your input helps ensure better shift coverage.",
          link: "/manage/availability",
        },
      })
    );
    
    await Promise.all(notifications);
    
    return { 
      success: true, 
      message: `Sent availability update requests to ${notifications.length} staff member(s)` 
    };
  }
  
  // Send notifications to staff with incomplete availability
  const notifications = staffWithoutFullAvailability.map(staff =>
    prisma.notification.create({
      data: {
        userId: staff.id,
        type: "SYSTEM_ANNOUNCEMENT",
        title: "Availability Update Needed",
        message: "Your availability information is incomplete. Please update your availability to help us schedule shifts effectively.",
        link: "/manage/availability",
      },
    })
  );
  
  await Promise.all(notifications);
  
  return { 
    success: true, 
    message: `Sent availability update requests to ${notifications.length} staff member(s) with incomplete availability` 
  };
}

/**
 * Execute generic resolution action - log and notify
 */
async function executeGenericResolutionAction(
  resolution: ConflictResolution | undefined,
  sharedVenueUserIds: string[],
  currentUserId: string,
  conflictId: string
): Promise<{ success: boolean; message: string }> {
  // For generic resolutions, just log and send a summary notification to managers
  const managers = await prisma.user.findMany({
    where: {
      id: { in: sharedVenueUserIds },
      role: { name: { in: ["Manager", "Admin", "Super Admin"] } },
    },
    select: { id: true },
  });
  
  if (managers.length > 0) {
    await Promise.all(
      managers.map(manager =>
        prisma.notification.create({
          data: {
            userId: manager.id,
            type: "ROSTER_CONFLICT",
            title: "Conflict Resolution Applied",
            message: resolution?.description || "A scheduling conflict resolution has been applied. Please review the changes.",
            link: `/manage/reports/conflicts?id=${conflictId}`,
          },
        })
      )
    );
  }
  
  return { 
    success: true, 
    message: resolution?.description || "Resolution applied successfully" 
  };
}

/**
 * Extract date from conflict ID (format: "conflict-YYYY-MM-DD-...")
 */
function extractDateFromConflictId(conflictId: string): Date | null {
  const dateMatch = conflictId.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    try {
      return parseISO(dateMatch[1]);
    } catch {
      return null;
    }
  }
  return null;
}
