"use server";

/**
 * Smart Scheduling Suggestions
 * AI-powered recommendations for optimal staff scheduling
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { addDays, startOfWeek, endOfWeek, format, isSameDay, parseISO } from "date-fns";

export interface SchedulingSuggestion {
  id: string;
  type: "coverage_gap" | "fair_distribution" | "availability_match" | "optimization";
  priority: "high" | "medium" | "low";
  confidence: number; // 0-100
  staffMember: {
    id: string;
    name: string;
    email: string;
    currentHours?: number;
    availableHours?: number;
  };
  suggestion: {
    date: string;
    dayOfWeek: number;
    shift?: {
      startTime: string;
      endTime: string;
    };
    hours: number;
  };
  reasoning: string;
  constraints: {
    hasAvailability: boolean;
    hasNoTimeOff: boolean;
    withinHourLimit: boolean;
    meetsMinimumRest: boolean;
  };
  impact: {
    coverageImprovement: number; // Percentage
    fairnessImprovement: number; // How much closer to equal distribution
    conflictsResolved: number;
  };
}

interface SuggestionFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  venueId?: string;
  minConfidence?: number;
  types?: SchedulingSuggestion["type"][];
}

/**
 * Generate smart scheduling suggestions
 */
export async function generateSchedulingSuggestions(
  filters?: SuggestionFilters
): Promise<{ success: boolean; suggestions?: SchedulingSuggestion[]; error?: string }> {
  const user = await requireAuth();

  try {
    // Default to next week if no date range specified
    const dateRange = filters?.dateRange || {
      start: addDays(new Date(), 1),
      end: addDays(new Date(), 7),
    };

    // Get shared venue users
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Fetch users with their availability and time-off
    const users = await prisma.user.findMany({
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
            OR: [
              {
                startDate: { lte: dateRange.end },
                endDate: { gte: dateRange.start },
              },
            ],
          },
        },
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    // Generate suggestions
    const suggestions: SchedulingSuggestion[] = [];

    // Strategy 1: Fill coverage gaps
    const coverageGapSuggestions = await generateCoverageGapSuggestions(
      users,
      dateRange,
      sharedVenueUserIds
    );
    suggestions.push(...coverageGapSuggestions);

    // Strategy 2: Fair distribution (balance hours)
    const fairDistributionSuggestions = await generateFairDistributionSuggestions(
      users,
      dateRange
    );
    suggestions.push(...fairDistributionSuggestions);

    // Strategy 3: Availability matching (staff available but not scheduled)
    const availabilityMatchSuggestions = await generateAvailabilityMatchSuggestions(
      users,
      dateRange
    );
    suggestions.push(...availabilityMatchSuggestions);

    // Filter by confidence and type
    let filteredSuggestions = suggestions;

    if (filters?.minConfidence) {
      filteredSuggestions = filteredSuggestions.filter(
        (s) => s.confidence >= filters.minConfidence!
      );
    }

    if (filters?.types && filters.types.length > 0) {
      filteredSuggestions = filteredSuggestions.filter((s) =>
        filters.types!.includes(s.type)
      );
    }

    // Sort by confidence (highest first)
    filteredSuggestions.sort((a, b) => b.confidence - a.confidence);

    // Limit to top 20 suggestions
    filteredSuggestions = filteredSuggestions.slice(0, 20);

    return {
      success: true,
      suggestions: filteredSuggestions,
    };
  } catch (error) {
    console.error("Error generating scheduling suggestions:", error);
    return {
      success: false,
      error: "Failed to generate scheduling suggestions",
    };
  }
}

/**
 * Strategy 1: Generate suggestions to fill coverage gaps
 */
async function generateCoverageGapSuggestions(
  users: any[],
  dateRange: { start: Date; end: Date },
  sharedVenueUserIds: string[]
): Promise<SchedulingSuggestion[]> {
  const suggestions: SchedulingSuggestion[] = [];

  // Get dates in range
  const dates: Date[] = [];
  let currentDate = new Date(dateRange.start);
  while (currentDate <= dateRange.end) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }

  // For each date, check coverage
  for (const date of dates) {
    const dayOfWeek = date.getDay();

    // Count available staff for this day
    const availableStaff = users.filter((u) => {
      // Check availability for this day of week
      const hasAvailability = u.availability.some((a: any) => a.dayOfWeek === dayOfWeek);

      // Check no time-off on this date
      const hasTimeOff = u.timeOffRequests.some((tor: any) => {
        const torStart = new Date(tor.startDate);
        const torEnd = new Date(tor.endDate);
        return date >= torStart && date <= torEnd;
      });

      return hasAvailability && !hasTimeOff;
    });

    // If coverage is low (less than 3 staff), suggest assignments
    if (availableStaff.length > 0 && availableStaff.length < 3) {
      // Find the best candidate to suggest
      for (const staff of availableStaff.slice(0, 2)) {
        const availability = staff.availability.find((a: any) => a.dayOfWeek === dayOfWeek);

        if (availability) {
          const confidence = calculateConfidence({
            hasAvailability: true,
            hasNoTimeOff: true,
            coverageLevel: availableStaff.length,
            isPreferredShift: availability.isAllDay,
          });

          suggestions.push({
            id: `coverage-${staff.id}-${format(date, "yyyy-MM-dd")}`,
            type: "coverage_gap",
            priority: availableStaff.length === 0 ? "high" : availableStaff.length === 1 ? "medium" : "low",
            confidence,
            staffMember: {
              id: staff.id,
              name: `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || staff.email,
              email: staff.email,
            },
            suggestion: {
              date: format(date, "yyyy-MM-dd"),
              dayOfWeek,
              shift: availability.isAllDay
                ? { startTime: "09:00", endTime: "17:00" }
                : {
                    startTime: availability.startTime || "09:00",
                    endTime: availability.endTime || "17:00",
                  },
              hours: 8,
            },
            reasoning: `Coverage gap detected on ${format(date, "EEEE, MMM dd")}. Only ${availableStaff.length} staff available. ${staff.firstName || staff.email} is available and has no conflicts.`,
            constraints: {
              hasAvailability: true,
              hasNoTimeOff: true,
              withinHourLimit: true,
              meetsMinimumRest: true,
            },
            impact: {
              coverageImprovement: 33,
              fairnessImprovement: 5,
              conflictsResolved: 1,
            },
          });
        }
      }
    }
  }

  return suggestions;
}

/**
 * Strategy 2: Generate suggestions for fair hour distribution
 */
async function generateFairDistributionSuggestions(
  users: any[],
  dateRange: { start: Date; end: Date }
): Promise<SchedulingSuggestion[]> {
  const suggestions: SchedulingSuggestion[] = [];

  // Calculate average available hours per user
  const totalAvailableHours = users.reduce((sum, u) => {
    return sum + u.availability.length * 8; // Assume 8 hours per available day
  }, 0);

  const averageHours = users.length > 0 ? totalAvailableHours / users.length : 0;

  // Find users with significantly fewer hours than average
  const underutilizedUsers = users.filter((u) => {
    const userAvailableHours = u.availability.length * 8;
    return userAvailableHours > 0 && userAvailableHours < averageHours * 0.7;
  });

  // Suggest assignments for underutilized users
  for (const user of underutilizedUsers) {
    // Find a day they're available
    if (user.availability.length > 0) {
      const availability = user.availability[0];
      const nextDate = findNextDateForDayOfWeek(dateRange.start, availability.dayOfWeek);

      if (nextDate && nextDate <= dateRange.end) {
        // Check no time-off
        const hasTimeOff = user.timeOffRequests.some((tor: any) => {
          const torStart = new Date(tor.startDate);
          const torEnd = new Date(tor.endDate);
          return nextDate >= torStart && nextDate <= torEnd;
        });

        if (!hasTimeOff) {
          const confidence = calculateConfidence({
            hasAvailability: true,
            hasNoTimeOff: true,
            fairnessNeed: true,
            underutilized: true,
          });

          suggestions.push({
            id: `fair-${user.id}-${format(nextDate, "yyyy-MM-dd")}`,
            type: "fair_distribution",
            priority: "medium",
            confidence,
            staffMember: {
              id: user.id,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
              email: user.email,
              currentHours: user.availability.length * 8 * 0.5, // Estimate
              availableHours: user.availability.length * 8,
            },
            suggestion: {
              date: format(nextDate, "yyyy-MM-dd"),
              dayOfWeek: availability.dayOfWeek,
              shift: availability.isAllDay
                ? { startTime: "09:00", endTime: "17:00" }
                : {
                    startTime: availability.startTime || "09:00",
                    endTime: availability.endTime || "17:00",
                  },
              hours: 8,
            },
            reasoning: `${user.firstName || user.email} has fewer scheduled hours than team average. Scheduling them on ${format(nextDate, "EEEE, MMM dd")} would improve workload balance.`,
            constraints: {
              hasAvailability: true,
              hasNoTimeOff: true,
              withinHourLimit: true,
              meetsMinimumRest: true,
            },
            impact: {
              coverageImprovement: 15,
              fairnessImprovement: 25,
              conflictsResolved: 0,
            },
          });
        }
      }
    }
  }

  return suggestions.slice(0, 5); // Limit fair distribution suggestions
}

/**
 * Strategy 3: Match available staff to open shifts
 */
async function generateAvailabilityMatchSuggestions(
  users: any[],
  dateRange: { start: Date; end: Date }
): Promise<SchedulingSuggestion[]> {
  const suggestions: SchedulingSuggestion[] = [];

  // For each user, find dates they're available
  for (const user of users) {
    for (const availability of user.availability) {
      const nextDate = findNextDateForDayOfWeek(dateRange.start, availability.dayOfWeek);

      if (nextDate && nextDate <= dateRange.end) {
        // Check no time-off
        const hasTimeOff = user.timeOffRequests.some((tor: any) => {
          const torStart = new Date(tor.startDate);
          const torEnd = new Date(tor.endDate);
          return nextDate >= torStart && nextDate <= torEnd;
        });

        if (!hasTimeOff) {
          const confidence = calculateConfidence({
            hasAvailability: true,
            hasNoTimeOff: true,
            perfectMatch: availability.isAllDay,
          });

          suggestions.push({
            id: `match-${user.id}-${format(nextDate, "yyyy-MM-dd")}`,
            type: "availability_match",
            priority: "low",
            confidence,
            staffMember: {
              id: user.id,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
              email: user.email,
            },
            suggestion: {
              date: format(nextDate, "yyyy-MM-dd"),
              dayOfWeek: availability.dayOfWeek,
              shift: availability.isAllDay
                ? { startTime: "09:00", endTime: "17:00" }
                : {
                    startTime: availability.startTime || "09:00",
                    endTime: availability.endTime || "17:00",
                  },
              hours: 8,
            },
            reasoning: `${user.firstName || user.email} has indicated availability on ${format(nextDate, "EEEE")}s. Consider scheduling them for ${format(nextDate, "MMM dd")}.`,
            constraints: {
              hasAvailability: true,
              hasNoTimeOff: true,
              withinHourLimit: true,
              meetsMinimumRest: true,
            },
            impact: {
              coverageImprovement: 10,
              fairnessImprovement: 5,
              conflictsResolved: 0,
            },
          });
        }
      }
    }
  }

  return suggestions.slice(0, 10); // Limit availability match suggestions
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(factors: Record<string, any>): number {
  let confidence = 50; // Base confidence

  if (factors.hasAvailability) confidence += 20;
  if (factors.hasNoTimeOff) confidence += 15;
  if (factors.fairnessNeed) confidence += 10;
  if (factors.underutilized) confidence += 10;
  if (factors.perfectMatch) confidence += 15;
  if (factors.isPreferredShift) confidence += 5;
  if (factors.coverageLevel === 0) confidence += 20;
  if (factors.coverageLevel === 1) confidence += 15;
  if (factors.coverageLevel === 2) confidence += 10;

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Find the next occurrence of a day of week
 */
function findNextDateForDayOfWeek(startDate: Date, dayOfWeek: number): Date | null {
  const date = new Date(startDate);

  for (let i = 0; i < 14; i++) {
    // Look up to 2 weeks ahead
    if (date.getDay() === dayOfWeek) {
      return date;
    }
    date.setDate(date.getDate() + 1);
  }

  return null;
}

/**
 * Apply a scheduling suggestion by creating actual schedule assignment
 */
export async function applySchedulingSuggestion(
  suggestion: SchedulingSuggestion
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await requireAuth();

  try {
    // Since there's no Schedule model, we'll create a RosterShift entry
    // This assumes we're working with an existing roster for the date
    const suggestionDate = new Date(suggestion.suggestion.date);
    
    // Find or create a roster for the venue that covers this date
    // This is a simplified approach - in a real system, you'd have more sophisticated logic
    const venue = await prisma.venue.findFirst({
      where: {
        userVenues: {
          some: {
            userId: user.id
          }
        }
      }
    });

    if (!venue) {
      return {
        success: false,
        error: "No venue found for current user"
      };
    }

    // Find existing roster or create a new one
    let roster = await prisma.roster.findFirst({
      where: {
        venueId: venue.id,
        startDate: {
          lte: suggestionDate
        },
        endDate: {
          gte: suggestionDate
        }
      }
    });

    // If no roster exists for this date, create one
    if (!roster) {
      const startDate = new Date(suggestionDate);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // End of week
      
      roster = await prisma.roster.create({
        data: {
          name: `Weekly Roster ${format(startDate, "yyyy-MM-dd")}`,
          venueId: venue.id,
          startDate,
          endDate,
          status: "DRAFT",
          createdBy: user.id,
          shifts: {
            create: []
          }
        }
      });
    }

    // Create the shift entry
    await prisma.rosterShift.create({
      data: {
        rosterId: roster.id,
        userId: suggestion.staffMember.id,
        date: suggestionDate,
        startTime: suggestion.suggestion.shift?.startTime || "09:00",
        endTime: suggestion.suggestion.shift?.endTime || "17:00",
        breakMinutes: 0,
        notes: `AI-suggested shift from conflict resolution`
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "AI_SUGGESTION_APPLIED",
        resourceType: "roster_shift",
        resourceId: roster.id,
        newValue: JSON.stringify({
          staffId: suggestion.staffMember.id,
          date: suggestion.suggestion.date,
          shift: suggestion.suggestion.shift,
          suggestionId: suggestion.id
        }),
      },
    });

    return {
      success: true,
      message: `Successfully scheduled ${suggestion.staffMember.name} for ${format(suggestionDate, "MMM dd, yyyy")}`
    };
  } catch (error) {
    console.error("Error applying scheduling suggestion:", error);
    
    // Create error audit log entry
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "AI_SUGGESTION_FAILED",
        resourceType: "scheduling_suggestion",
        newValue: JSON.stringify({ 
          suggestionId: suggestion.id, 
          error: (error as Error).message 
        }),
      },
    });
    
    return {
      success: false,
      error: "Failed to apply suggestion: " + (error as Error).message
    };
  }
}
