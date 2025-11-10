/**
 * Venue Utility Functions
 *
 * Helper functions for multi-venue support:
 * - Get user's venue IDs
 * - Check venue access permissions
 * - Filter queries by venue
 * - Find users in shared venues
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Get all venue IDs assigned to a user
 *
 * @param userId - User ID to get venues for
 * @returns Array of venue IDs
 */
export async function getUserVenueIds(userId: string): Promise<string[]> {
  const userVenues = await prisma.userVenue.findMany({
    where: {
      userId,
      venue: {
        active: true, // Only return active venues
      },
    },
    select: {
      venueId: true,
    },
  });

  return userVenues.map((uv) => uv.venueId);
}

/**
 * Get user's primary venue ID
 *
 * @param userId - User ID
 * @returns Primary venue ID or null
 */
export async function getPrimaryVenueId(userId: string): Promise<string | null> {
  const primaryVenue = await prisma.userVenue.findFirst({
    where: {
      userId,
      isPrimary: true,
      venue: {
        active: true,
      },
    },
    select: {
      venueId: true,
    },
  });

  return primaryVenue?.venueId || null;
}

/**
 * Check if a user has access to a specific venue
 *
 * @param userId - User ID
 * @param venueId - Venue ID to check
 * @returns true if user has access, false otherwise
 */
export async function canAccessVenue(
  userId: string,
  venueId: string
): Promise<boolean> {
  const userVenue = await prisma.userVenue.findUnique({
    where: {
      userId_venueId: {
        userId,
        venueId,
      },
    },
    include: {
      venue: {
        select: {
          active: true,
        },
      },
    },
  });

  return userVenue !== null && userVenue.venue.active;
}

/**
 * Get Prisma where clause to filter by user's venues
 *
 * Use this in queries to restrict data to user's assigned venues.
 *
 * Example usage:
 * ```ts
 * const users = await prisma.user.findMany({
 *   where: await filterByUserVenues(currentUser.id)
 * });
 * ```
 *
 * @param userId - User ID to filter by
 * @returns Prisma where clause
 */
export async function filterByUserVenues(userId: string) {
  const venueIds = await getUserVenueIds(userId);

  if (venueIds.length === 0) {
    // User has no venues - return impossible condition
    return {
      id: "impossible-id-no-venues",
    };
  }

  return {
    venues: {
      some: {
        venueId: {
          in: venueIds,
        },
      },
    },
  };
}

/**
 * Get all users who share at least one venue with the given user
 *
 * @param userId - User ID to find shared venue users for
 * @param options - Optional filters
 * @returns Array of user IDs who share venues
 */
export async function getSharedVenueUsers(
  userId: string,
  options?: {
    includeInactive?: boolean;
  }
): Promise<string[]> {
  const venueIds = await getUserVenueIds(userId);

  if (venueIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: userId, // Exclude the user themselves
      },
      ...(options?.includeInactive ? {} : { active: true }),
      venues: {
        some: {
          venueId: {
            in: venueIds,
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return users.map((u) => u.id);
}

/**
 * Get users in a specific venue
 *
 * @param venueId - Venue ID
 * @param options - Optional filters
 * @returns Array of user IDs in the venue
 */
export async function getUsersInVenue(
  venueId: string,
  options?: {
    includeInactive?: boolean;
  }
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(options?.includeInactive ? {} : { active: true }),
      venues: {
        some: {
          venueId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  return users.map((u) => u.id);
}

/**
 * Check if two users share any venues
 *
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns true if users share at least one venue
 */
export async function usersShareVenue(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const user1Venues = await getUserVenueIds(userId1);
  const user2Venues = await getUserVenueIds(userId2);

  return user1Venues.some((venueId) => user2Venues.includes(venueId));
}

/**
 * Get shared venues between multiple users
 *
 * @param userIds - Array of user IDs
 * @returns Array of venue IDs that all users have in common
 */
export async function getSharedVenues(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) {
    return [];
  }

  if (userIds.length === 1) {
    return getUserVenueIds(userIds[0]);
  }

  // Get venues for each user
  const userVenues = await Promise.all(
    userIds.map((userId) => getUserVenueIds(userId))
  );

  // Find intersection of all venue arrays
  const firstUserVenues = userVenues[0];
  const sharedVenues = firstUserVenues.filter((venueId) =>
    userVenues.every((venues) => venues.includes(venueId))
  );

  return sharedVenues;
}

/**
 * Add venue filter to a Prisma query for user data
 *
 * This creates a filter for queries on models that have a userId field
 *
 * @param currentUserId - Current user's ID
 * @param targetField - Field name that contains the user relation (default: 'user')
 * @returns Prisma where clause
 */
export async function addVenueFilterForUser(
  currentUserId: string,
  targetField: string = "user"
): Promise<Record<string, any>> {
  const venueIds = await getUserVenueIds(currentUserId);

  if (venueIds.length === 0) {
    return {
      [targetField]: {
        id: "impossible-id-no-venues",
      },
    };
  }

  return {
    [targetField]: {
      venues: {
        some: {
          venueId: {
            in: venueIds,
          },
        },
      },
    },
  };
}

/**
 * Get venue statistics for a user
 *
 * @param userId - User ID
 * @returns Statistics about user's venue assignments
 */
export async function getUserVenueStats(userId: string) {
  const venues = await prisma.userVenue.findMany({
    where: { userId },
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          code: true,
          active: true,
        },
      },
    },
  });

  const primaryVenue = venues.find((v) => v.isPrimary);

  return {
    totalVenues: venues.length,
    activeVenues: venues.filter((v) => v.venue.active).length,
    inactiveVenues: venues.filter((v) => !v.venue.active).length,
    primaryVenue: primaryVenue?.venue || null,
    venues: venues.map((v) => ({
      ...v.venue,
      isPrimary: v.isPrimary,
    })),
  };
}

/**
 * Format venue display name with primary indicator
 *
 * @param venueName - Venue name
 * @param isPrimary - Whether this is the primary venue
 * @returns Formatted venue name
 */
export function formatVenueName(venueName: string, isPrimary: boolean): string {
  return isPrimary ? `${venueName} (Primary)` : venueName;
}

/**
 * Get venue badge color based on status
 *
 * @param isActive - Whether venue is active
 * @param isPrimary - Whether this is user's primary venue
 * @returns Tailwind color class
 */
export function getVenueBadgeColor(
  isActive: boolean,
  isPrimary: boolean
): string {
  if (!isActive) {
    return "bg-gray-100 text-gray-600 border-gray-300";
  }

  if (isPrimary) {
    return "bg-blue-100 text-blue-700 border-blue-300";
  }

  return "bg-green-100 text-green-700 border-green-300";
}
