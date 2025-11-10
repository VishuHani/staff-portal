/**
 * Database Test Helpers
 * Utilities for mocking Prisma and managing test data
 */

import { vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  testUsers,
  testVenues,
  testUserVenues,
  testRoles,
} from "./fixtures";

// ============================================================================
// PRISMA MOCK
// ============================================================================

/**
 * Create a mock Prisma client for testing
 * This allows us to mock database calls without hitting a real database
 */
export const createMockPrisma = () => {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    venue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userVenue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    conversationParticipant: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    timeOffRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    availability: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(createMockPrisma())),
  } as unknown as PrismaClient;
};

// ============================================================================
// MOCK DATA SETUP
// ============================================================================

/**
 * Setup mock data for venue-related tests
 * Returns a configured mock prisma with predefined test data
 */
export const setupMockVenueData = () => {
  const mockPrisma = createMockPrisma();

  // Mock user venue queries
  mockPrisma.userVenue.findMany = vi.fn((args: any) => {
    const userId = args?.where?.userId;
    if (!userId) return Promise.resolve([]);

    return Promise.resolve(
      testUserVenues
        .filter((uv) => uv.userId === userId)
        .map((uv) => ({
          ...uv,
          venue: testVenues[Object.keys(testVenues).find(
            (key) => testVenues[key as keyof typeof testVenues].id === uv.venueId
          ) as keyof typeof testVenues],
        }))
    );
  });

  // Mock venue queries
  mockPrisma.venue.findMany = vi.fn((args: any) => {
    let venues = Object.values(testVenues);

    // Filter by active status if specified
    if (args?.where?.active !== undefined) {
      venues = venues.filter((v) => v.active === args.where.active);
    }

    return Promise.resolve(venues);
  });

  mockPrisma.venue.findUnique = vi.fn((args: any) => {
    const venueId = args?.where?.id;
    const venue = Object.values(testVenues).find((v) => v.id === venueId);
    return Promise.resolve(venue || null);
  });

  // Mock user queries
  mockPrisma.user.findMany = vi.fn((args: any) => {
    let users = Object.values(testUsers);

    // Filter by venue if specified
    if (args?.where?.venues?.some) {
      const venueIds = args.where.venues.some.venueId?.in || [];
      const userIdsInVenues = testUserVenues
        .filter((uv) => venueIds.includes(uv.venueId))
        .map((uv) => uv.userId);
      users = users.filter((u) => userIdsInVenues.includes(u.id));
    }

    // Add venues relation if included
    if (args?.include?.venues) {
      return Promise.resolve(
        users.map((u) => ({
          ...u,
          venues: testUserVenues
            .filter((uv) => uv.userId === u.id)
            .map((uv) => ({
              ...uv,
              venue: Object.values(testVenues).find((v) => v.id === uv.venueId)!,
            })),
        }))
      );
    }

    return Promise.resolve(users);
  });

  mockPrisma.user.findUnique = vi.fn((args: any) => {
    const userId = args?.where?.id;
    const user = Object.values(testUsers).find((u) => u.id === userId);

    if (!user) return Promise.resolve(null);

    // Add venues relation if included
    if (args?.include?.venues) {
      return Promise.resolve({
        ...user,
        role: testRoles[Object.keys(testRoles).find(
          (key) => testRoles[key as keyof typeof testRoles].id === user.roleId
        ) as keyof typeof testRoles],
        venues: testUserVenues
          .filter((uv) => uv.userId === user.id)
          .map((uv) => ({
            ...uv,
            venue: Object.values(testVenues).find((v) => v.id === uv.venueId)!,
          })),
      });
    }

    return Promise.resolve(user);
  });

  return mockPrisma;
};

// ============================================================================
// MOCK CURRENT USER
// ============================================================================

/**
 * Mock the getCurrentUser function for authenticated tests
 */
export const mockCurrentUser = (userId: string) => {
  const user = Object.values(testUsers).find((u) => u.id === userId);
  if (!user) {
    throw new Error(`Test user not found: ${userId}`);
  }

  const userWithRelations = {
    ...user,
    role: testRoles[Object.keys(testRoles).find(
      (key) => testRoles[key as keyof typeof testRoles].id === user.roleId
    ) as keyof typeof testRoles],
    venues: testUserVenues
      .filter((uv) => uv.userId === user.id)
      .map((uv) => ({
        ...uv,
        venue: Object.values(testVenues).find((v) => v.id === uv.venueId)!,
      })),
  };

  return userWithRelations;
};

// ============================================================================
// ASSERTIONS
// ============================================================================

/**
 * Assert that a Prisma where clause contains venue filtering
 */
export const assertHasVenueFilter = (whereClause: any) => {
  if (!whereClause) {
    throw new Error("Where clause is undefined");
  }

  const hasVenueFilter =
    whereClause.venues?.some ||
    whereClause.author?.venues?.some ||
    whereClause.user?.venues?.some ||
    whereClause.sender?.venues?.some ||
    whereClause.participants?.some?.user?.venues?.some;

  if (!hasVenueFilter) {
    throw new Error(
      `Expected where clause to contain venue filtering, got: ${JSON.stringify(whereClause, null, 2)}`
    );
  }

  return true;
};

/**
 * Extract venue IDs from a Prisma where clause
 */
export const extractVenueIdsFromWhere = (whereClause: any): string[] => {
  if (!whereClause) return [];

  // Check various possible locations of venueId filter
  const venueIdIn =
    whereClause.venues?.some?.venueId?.in ||
    whereClause.author?.venues?.some?.venueId?.in ||
    whereClause.user?.venues?.some?.venueId?.in ||
    whereClause.sender?.venues?.some?.venueId?.in ||
    whereClause.participants?.some?.user?.venues?.some?.venueId?.in ||
    [];

  return Array.isArray(venueIdIn) ? venueIdIn : [];
};
