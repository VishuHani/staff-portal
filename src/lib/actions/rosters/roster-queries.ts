"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { RosterStatus, Prisma } from "@prisma/client";

// Types
export interface RosterFilters {
  venueId?: string;
  status?: RosterStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  chainId?: string;
  isActive?: boolean; // Filter by active version in chain (true = only active, false = only superseded)
  includeSuperseded?: boolean; // Include superseded versions (default: false)
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Get rosters with filters
export async function getRosters(filters: RosterFilters = {}) {
  try {
    const user = await requireAuth();

    // Determine access level
    const canViewAll = await canAccess("rosters", "view_all");
    const canViewTeam = await canAccess("rosters", "view_team");

    if (!canViewAll && !canViewTeam) {
      return { success: false, error: "You don't have permission to view rosters", rosters: [] };
    }

    // Build where clause
    const where: Prisma.RosterWhereInput = {};

    // Venue filter
    if (filters.venueId) {
      where.venueId = filters.venueId;
    } else if (!canViewAll) {
      // Managers can only see rosters for their venues
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      where.venueId = { in: userVenues.map((v) => v.venueId) };
    }

    // Status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Date range filter
    if (filters.startDate) {
      where.startDate = { gte: filters.startDate };
    }
    if (filters.endDate) {
      where.endDate = { lte: filters.endDate };
    }

    // Chain filter
    if (filters.chainId) {
      where.chainId = filters.chainId;
    }

    // Build AND conditions for search and active filter
    const andConditions: Prisma.RosterWhereInput[] = [];

    // Search filter - must be in AND to combine with active filter
    if (filters.search) {
      andConditions.push({
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }

    // Active version filter
    if (filters.isActive !== undefined) {
      andConditions.push({ isActive: filters.isActive });
    } else if (!filters.includeSuperseded) {
      // By default, show active versions OR any drafts
      // (drafts may have isActive: false when created as a new version)
      andConditions.push({
        OR: [
          { isActive: true },
          { status: RosterStatus.DRAFT }
        ],
      });
    }

    // Apply AND conditions if any
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const rosters = await prisma.roster.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: { shifts: true },
        },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    // Consolidate rosters by chain - show only one representative per chain
    // For chains: prefer active version, else highest version number
    // Also count total versions and check for draft in each chain
    const chainVersionCounts: Record<string, number> = {};
    const chainHasDraft: Record<string, boolean> = {};

    // First pass: count versions and check for drafts per chain
    for (const roster of rosters) {
      if (roster.chainId) {
        chainVersionCounts[roster.chainId] = (chainVersionCounts[roster.chainId] || 0) + 1;
        if (roster.status === RosterStatus.DRAFT) {
          chainHasDraft[roster.chainId] = true;
        }
      }
    }

    // Second pass: pick representative roster for each chain
    const rostersMap = new Map<string, typeof rosters[0]>();
    const standaloneRosters: typeof rosters = [];

    for (const roster of rosters) {
      if (!roster.chainId) {
        standaloneRosters.push(roster);
      } else {
        const existing = rostersMap.get(roster.chainId);
        if (!existing) {
          rostersMap.set(roster.chainId, roster);
        } else {
          // Prefer active version, or higher version number if neither is active
          if (roster.isActive && !existing.isActive) {
            rostersMap.set(roster.chainId, roster);
          } else if (!existing.isActive && !roster.isActive && roster.versionNumber > existing.versionNumber) {
            rostersMap.set(roster.chainId, roster);
          }
        }
      }
    }

    const consolidatedRosters = [...standaloneRosters, ...rostersMap.values()];

    // Sort consolidated rosters by startDate desc, then createdAt desc
    consolidatedRosters.sort((a, b) => {
      const dateCompare = new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Enhance with chain info including total versions and draft status
    const rostersWithChainInfo = consolidatedRosters.map((roster) => ({
      ...roster,
      chainInfo: roster.chainId ? {
        chainId: roster.chainId,
        versionNumber: roster.versionNumber,
        isActive: roster.isActive,
        totalVersions: chainVersionCounts[roster.chainId] || 1,
        hasDraft: chainHasDraft[roster.chainId] || false,
      } : null,
    }));

    return { success: true, rosters: rostersWithChainInfo };
  } catch (error) {
    console.error("Error fetching rosters:", error);
    return { success: false, error: "Failed to fetch rosters", rosters: [] };
  }
}

// Get a single roster by ID with all details
export async function getRosterById(rosterId: string) {
  try {
    const user = await requireAuth();

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        publishedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        shifts: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, profileImage: true },
            },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        },
        history: {
          include: {
            performedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { performedAt: "desc" },
        },
        unmatchedEntries: {
          where: { resolved: false },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check access
    const canViewAll = await canAccess("rosters", "view_all");
    const canViewTeam = await canAccess("rosters", "view_team");

    if (!canViewAll) {
      if (canViewTeam) {
        const userVenues = await prisma.userVenue.findMany({
          where: { userId: user.id },
          select: { venueId: true },
        });
        const venueIds = userVenues.map((v) => v.venueId);
        if (!venueIds.includes(roster.venueId)) {
          return { success: false, error: "You don't have access to this roster" };
        }
      } else {
        return { success: false, error: "You don't have permission to view this roster" };
      }
    }

    // Get version chain info if roster is part of a chain
    let chainInfo = null;
    if (roster.chainId) {
      const chainVersions = await prisma.roster.findMany({
        where: { chainId: roster.chainId },
        select: {
          id: true,
          name: true,
          versionNumber: true,
          isActive: true,
          status: true,
          createdAt: true,
        },
        orderBy: { versionNumber: "desc" },
      });

      chainInfo = {
        chainId: roster.chainId,
        currentVersionNumber: roster.versionNumber,
        isActive: roster.isActive,
        totalVersions: chainVersions.length,
        versions: chainVersions,
      };
    }

    return { success: true, roster, chainInfo };
  } catch (error) {
    console.error("Error fetching roster:", error);
    return { success: false, error: "Failed to fetch roster" };
  }
}

// Get all versions in a roster's version chain
export async function getRosterVersionChain(rosterId: string) {
  try {
    await requireAuth();

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { chainId: true },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    if (!roster.chainId) {
      return { success: true, versions: [], message: "This roster is not part of a version chain" };
    }

    const versions = await prisma.roster.findMany({
      where: { chainId: roster.chainId },
      select: {
        id: true,
        name: true,
        versionNumber: true,
        revision: true,
        isActive: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { shifts: true } },
      },
      orderBy: { versionNumber: "desc" },
    });

    return { success: true, chainId: roster.chainId, versions };
  } catch (error) {
    console.error("Error fetching version chain:", error);
    return { success: false, error: "Failed to fetch version chain" };
  }
}

// Get shifts for a specific user (staff viewing their own shifts)
export async function getMyShifts(dateRange?: DateRange) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "view_own");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to view shifts", shifts: [] };
    }

    const where: Prisma.RosterShiftWhereInput = {
      userId: user.id,
      roster: {
        status: RosterStatus.PUBLISHED, // Only show published rosters
      },
    };

    if (dateRange) {
      where.date = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const shifts = await prisma.rosterShift.findMany({
      where,
      include: {
        roster: {
          select: {
            id: true,
            name: true,
            venue: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return { success: true, shifts };
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return { success: false, error: "Failed to fetch shifts", shifts: [] };
  }
}

// Get staff members available for a venue (for shift assignment)
export async function getVenueStaff(venueId: string) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission", staff: [] };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(venueId)) {
        return { success: false, error: "You don't have access to this venue", staff: [] };
      }
    }

    const staff = await prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [
          { venueId },
          { venues: { some: { venueId } } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
        role: { select: { name: true } },
        weekdayRate: true,
        saturdayRate: true,
        sundayRate: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return { success: true, staff };
  } catch (error) {
    console.error("Error fetching venue staff:", error);
    return { success: false, error: "Failed to fetch staff", staff: [] };
  }
}

// Get roster statistics for dashboard
export async function getRosterStats(venueId?: string) {
  try {
    const user = await requireAuth();

    const canViewAll = await canAccess("rosters", "view_all");
    const canViewTeam = await canAccess("rosters", "view_team");

    if (!canViewAll && !canViewTeam) {
      return { success: false, error: "You don't have permission" };
    }

    // Build venue filter
    let venueFilter: { venueId: string } | { venueId: { in: string[] } } | undefined;

    if (venueId) {
      venueFilter = { venueId };
    } else if (!canViewAll) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      venueFilter = { venueId: { in: userVenues.map((v) => v.venueId) } };
    }

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalRosters,
      draftRosters,
      publishedRosters,
      upcomingRosters,
      totalShifts,
      unassignedShifts,
      conflictShifts,
    ] = await Promise.all([
      prisma.roster.count({ where: venueFilter }),
      prisma.roster.count({ where: { ...venueFilter, status: RosterStatus.DRAFT } }),
      prisma.roster.count({ where: { ...venueFilter, status: RosterStatus.PUBLISHED } }),
      prisma.roster.count({
        where: {
          ...venueFilter,
          status: RosterStatus.PUBLISHED,
          startDate: { gte: now, lte: weekFromNow },
        },
      }),
      prisma.rosterShift.count({
        where: { roster: venueFilter },
      }),
      prisma.rosterShift.count({
        where: {
          roster: { ...venueFilter, status: RosterStatus.DRAFT },
          userId: null,
        },
      }),
      prisma.rosterShift.count({
        where: {
          roster: venueFilter,
          hasConflict: true,
        },
      }),
    ]);

    return {
      success: true,
      stats: {
        totalRosters,
        draftRosters,
        publishedRosters,
        upcomingRosters,
        totalShifts,
        unassignedShifts,
        conflictShifts,
      },
    };
  } catch (error) {
    console.error("Error fetching roster stats:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

// Get adjacent roster for week navigation (previous/next week)
export async function getAdjacentRoster(
  currentRosterId: string,
  direction: "previous" | "next"
) {
  try {
    await requireAuth();

    // Get current roster to find venue and date range
    const currentRoster = await prisma.roster.findUnique({
      where: { id: currentRosterId },
      select: {
        id: true,
        venueId: true,
        startDate: true,
        endDate: true,
        chainId: true,
      },
    });

    if (!currentRoster) {
      return { success: false, error: "Roster not found" };
    }

    // Find roster for adjacent week in same venue
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const targetDate = direction === "previous"
      ? new Date(currentRoster.startDate.getTime() - weekInMs)
      : new Date(currentRoster.endDate.getTime() + weekInMs);

    // Look for a roster that covers the target week
    const adjacentRoster = await prisma.roster.findFirst({
      where: {
        venueId: currentRoster.venueId,
        status: { in: [RosterStatus.PUBLISHED, RosterStatus.DRAFT] },
        isActive: true, // Prefer active versions
        OR: [
          // Roster starts within the target week
          {
            startDate: {
              gte: targetDate,
              lt: new Date(targetDate.getTime() + weekInMs),
            },
          },
          // Roster covers the target week
          {
            startDate: { lte: targetDate },
            endDate: { gte: targetDate },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        versionNumber: true,
      },
      orderBy: { startDate: direction === "previous" ? "desc" : "asc" },
    });

    if (!adjacentRoster) {
      return {
        success: true,
        roster: null,
        message: `No ${direction} week roster found`,
      };
    }

    return { success: true, roster: adjacentRoster };
  } catch (error) {
    console.error("Error finding adjacent roster:", error);
    return { success: false, error: "Failed to find adjacent roster" };
  }
}
