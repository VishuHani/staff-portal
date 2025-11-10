/**
 * Comprehensive Unit Tests for Venue Utility Functions
 *
 * Tests all 11 venue utility functions with focus on:
 * - Data isolation and security
 * - Multi-venue support
 * - Edge cases and error handling
 * - Active/inactive venue filtering
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues, testUserVenues } from "../../../helpers/fixtures";

// Mock the Prisma client - must be before importing the module under test
vi.mock("@/lib/prisma", () => ({
  prisma: {
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
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import {
  getUserVenueIds,
  getPrimaryVenueId,
  canAccessVenue,
  filterByUserVenues,
  getSharedVenueUsers,
  getUsersInVenue,
  usersShareVenue,
  getSharedVenues,
  addVenueFilterForUser,
  getUserVenueStats,
  formatVenueName,
  getVenueBadgeColor,
} from "@/lib/utils/venue";
import { prisma } from "@/lib/prisma";

describe("Venue Utility Functions", () => {
  let mockPrisma: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Get mock prisma instance
    mockPrisma = prisma;
  });

  // ==========================================================================
  // getUserVenueIds() - Get all venue IDs for a user
  // ==========================================================================
  describe("getUserVenueIds()", () => {
    it("should return all active venue IDs for user with multiple venues", async () => {
      // User 1 has Venue A (primary) and Venue B
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await getUserVenueIds(testUsers.user1.id);

      expect(result).toHaveLength(2);
      expect(result).toContain(testVenues.venueA.id);
      expect(result).toContain(testVenues.venueB.id);

      // Verify query filters for active venues
      expect(mockPrisma.userVenue.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUsers.user1.id,
          venue: {
            active: true,
          },
        },
        select: {
          venueId: true,
        },
      });
    });

    it("should return single venue ID for user with one venue", async () => {
      // User 2 has only Venue B
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await getUserVenueIds(testUsers.user2.id);

      expect(result).toHaveLength(1);
      expect(result).toContain(testVenues.venueB.id);
    });

    it("should return empty array for user with no venues", async () => {
      // User 5 has no venues
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await getUserVenueIds(testUsers.user5.id);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it("should include only active venues", async () => {
      // Mock user with one active and one inactive venue
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        // Venue C is inactive and should be filtered by the query
      ] as any);

      const result = await getUserVenueIds(testUsers.user3.id);

      // Should only return active venue A, not inactive venue C
      expect(result).toContain(testVenues.venueA.id);
      expect(result).not.toContain(testVenues.venueC.id);
    });

    it("should exclude inactive venues through database query", async () => {
      // User 4 has only inactive Venue C
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await getUserVenueIds(testUsers.user4.id);

      // Should return empty array since inactive venues are filtered
      expect(result).toHaveLength(0);
      expect(mockPrisma.userVenue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            venue: { active: true },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // getPrimaryVenueId() - Get user's primary venue
  // ==========================================================================
  describe("getPrimaryVenueId()", () => {
    it("should return primary venue ID when user has primary venue", async () => {
      // User 1 has Venue A as primary
      mockPrisma.userVenue.findFirst.mockResolvedValue({
        venueId: testVenues.venueA.id,
      } as any);

      const result = await getPrimaryVenueId(testUsers.user1.id);

      expect(result).toBe(testVenues.venueA.id);
      expect(mockPrisma.userVenue.findFirst).toHaveBeenCalledWith({
        where: {
          userId: testUsers.user1.id,
          isPrimary: true,
          venue: {
            active: true,
          },
        },
        select: {
          venueId: true,
        },
      });
    });

    it("should return null when no primary venue set", async () => {
      // User has venues but none marked as primary
      mockPrisma.userVenue.findFirst.mockResolvedValue(null);

      const result = await getPrimaryVenueId(testUsers.user1.id);

      expect(result).toBeNull();
    });

    it("should return null when user has no venues", async () => {
      // User 5 has no venues
      mockPrisma.userVenue.findFirst.mockResolvedValue(null);

      const result = await getPrimaryVenueId(testUsers.user5.id);

      expect(result).toBeNull();
    });

    it("should handle only inactive venues by returning null", async () => {
      // User 4 has only inactive Venue C as primary
      // Query filters for active venues, so returns null
      mockPrisma.userVenue.findFirst.mockResolvedValue(null);

      const result = await getPrimaryVenueId(testUsers.user4.id);

      expect(result).toBeNull();
      expect(mockPrisma.userVenue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            venue: { active: true },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // canAccessVenue() - SECURITY CRITICAL - Check venue access
  // ==========================================================================
  describe("canAccessVenue() - SECURITY CRITICAL", () => {
    it("should return true when user has access to active venue", async () => {
      // User 1 has access to Venue A
      mockPrisma.userVenue.findUnique.mockResolvedValue({
        userId: testUsers.user1.id,
        venueId: testVenues.venueA.id,
        venue: { active: true },
      } as any);

      const result = await canAccessVenue(testUsers.user1.id, testVenues.venueA.id);

      expect(result).toBe(true);
      expect(mockPrisma.userVenue.findUnique).toHaveBeenCalledWith({
        where: {
          userId_venueId: {
            userId: testUsers.user1.id,
            venueId: testVenues.venueA.id,
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
    });

    it("should return false when user doesn't have access", async () => {
      // User 2 doesn't have access to Venue A
      mockPrisma.userVenue.findUnique.mockResolvedValue(null);

      const result = await canAccessVenue(testUsers.user2.id, testVenues.venueA.id);

      expect(result).toBe(false);
    });

    it("should return false for inactive venue", async () => {
      // User 3 has access to Venue C but it's inactive
      mockPrisma.userVenue.findUnique.mockResolvedValue({
        userId: testUsers.user3.id,
        venueId: testVenues.venueC.id,
        venue: { active: false },
      } as any);

      const result = await canAccessVenue(testUsers.user3.id, testVenues.venueC.id);

      expect(result).toBe(false);
    });

    it("should return false when venue doesn't exist", async () => {
      // Non-existent venue
      mockPrisma.userVenue.findUnique.mockResolvedValue(null);

      const result = await canAccessVenue(testUsers.user1.id, "non-existent-venue-id");

      expect(result).toBe(false);
    });

    it("should return false when user doesn't exist", async () => {
      // Non-existent user
      mockPrisma.userVenue.findUnique.mockResolvedValue(null);

      const result = await canAccessVenue("non-existent-user-id", testVenues.venueA.id);

      expect(result).toBe(false);
    });

    it("should handle edge case of user with no venues", async () => {
      // User 5 has no venues
      mockPrisma.userVenue.findUnique.mockResolvedValue(null);

      const result = await canAccessVenue(testUsers.user5.id, testVenues.venueA.id);

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // filterByUserVenues() - Filter queries by user's venues
  // ==========================================================================
  describe("filterByUserVenues()", () => {
    it("should return correct Prisma where clause for user with venues", async () => {
      // User 1 has Venue A and Venue B
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await filterByUserVenues(testUsers.user1.id);

      expect(result).toEqual({
        venues: {
          some: {
            venueId: {
              in: [testVenues.venueA.id, testVenues.venueB.id],
            },
          },
        },
      });
    });

    it("should return where clause excluding inactive venues", async () => {
      // Mock will return only active venues (database query filters)
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      const result = await filterByUserVenues(testUsers.user3.id);

      // Should only include active venue A
      expect(result).toEqual({
        venues: {
          some: {
            venueId: {
              in: [testVenues.venueA.id],
            },
          },
        },
      });
    });

    it("should return where clause for user with no venues that matches nothing", async () => {
      // User 5 has no venues
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await filterByUserVenues(testUsers.user5.id);

      // Should return impossible condition to match nothing
      expect(result).toEqual({
        id: "impossible-id-no-venues",
      });
    });

    it("should handle multi-venue users correctly", async () => {
      // Admin has all venues
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
        // Venue C is inactive and filtered by query
      ] as any);

      const result = await filterByUserVenues(testUsers.admin.id);

      expect(result.venues.some.venueId.in).toHaveLength(2);
      expect(result.venues.some.venueId.in).toContain(testVenues.venueA.id);
      expect(result.venues.some.venueId.in).toContain(testVenues.venueB.id);
    });

    it("should return correct venueId array structure", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await filterByUserVenues(testUsers.user2.id);

      expect(result).toHaveProperty("venues.some.venueId.in");
      expect(Array.isArray(result.venues.some.venueId.in)).toBe(true);
    });
  });

  // ==========================================================================
  // getSharedVenueUsers() - SECURITY CRITICAL - Get users in shared venues
  // ==========================================================================
  describe("getSharedVenueUsers() - SECURITY CRITICAL", () => {
    it("should return users sharing active venues", async () => {
      // User 1 has Venue A and Venue B
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
      ] as any);

      // Users sharing these venues (excluding user1)
      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user2.id }, // shares Venue B
        { id: testUsers.user3.id }, // shares Venue A
      ] as any);

      const result = await getSharedVenueUsers(testUsers.user1.id);

      expect(result).toHaveLength(2);
      expect(result).toContain(testUsers.user2.id);
      expect(result).toContain(testUsers.user3.id);
    });

    it("should exclude the requesting user", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user3.id },
      ] as any);

      const result = await getSharedVenueUsers(testUsers.user1.id);

      expect(result).not.toContain(testUsers.user1.id);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: testUsers.user1.id },
          }),
        })
      );
    });

    it("should filter by active status when not specified (default)", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user3.id },
      ] as any);

      await getSharedVenueUsers(testUsers.user1.id);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
          }),
        })
      );
    });

    it("should include inactive users when specified", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user3.id },
      ] as any);

      await getSharedVenueUsers(testUsers.user1.id, { includeInactive: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            active: expect.anything(),
          }),
        })
      );
    });

    it("should return empty array for user with no venues", async () => {
      // User 5 has no venues
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await getSharedVenueUsers(testUsers.user5.id);

      expect(result).toEqual([]);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it("should handle user in multiple venues correctly", async () => {
      // Admin has multiple venues
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
      ] as any);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user1.id },
        { id: testUsers.user2.id },
        { id: testUsers.user3.id },
      ] as any);

      const result = await getSharedVenueUsers(testUsers.admin.id);

      expect(result.length).toBeGreaterThan(0);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            venues: {
              some: {
                venueId: {
                  in: [testVenues.venueA.id, testVenues.venueB.id],
                },
              },
            },
          }),
        })
      );
    });

    it("should exclude inactive venue users through venue filter", async () => {
      // User 3 has Venue A (active) and Venue C (inactive)
      // getUserVenueIds only returns active venues
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user1.id },
      ] as any);

      const result = await getSharedVenueUsers(testUsers.user3.id);

      // Should only search in active venue A, not inactive venue C
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            venues: {
              some: {
                venueId: {
                  in: [testVenues.venueA.id],
                },
              },
            },
          }),
        })
      );
    });

    it("should return correct user ID array", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueB.id },
      ] as any);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user1.id },
      ] as any);

      const result = await getSharedVenueUsers(testUsers.user2.id);

      expect(Array.isArray(result)).toBe(true);
      expect(result.every((id) => typeof id === "string")).toBe(true);
    });
  });

  // ==========================================================================
  // getUsersInVenue() - Get users in a specific venue
  // ==========================================================================
  describe("getUsersInVenue()", () => {
    it("should return all active users in a venue", async () => {
      // Venue A has User 1 and User 3
      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user1.id },
        { id: testUsers.user3.id },
      ] as any);

      const result = await getUsersInVenue(testVenues.venueA.id);

      expect(result).toHaveLength(2);
      expect(result).toContain(testUsers.user1.id);
      expect(result).toContain(testUsers.user3.id);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          active: true,
          venues: {
            some: {
              venueId: testVenues.venueA.id,
            },
          },
        },
        select: {
          id: true,
        },
      });
    });

    it("should include inactive users when specified", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user1.id },
        { id: testUsers.user3.id },
      ] as any);

      await getUsersInVenue(testVenues.venueA.id, { includeInactive: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            venues: expect.any(Object),
          }),
        })
      );

      // Should not have active filter
      const callArgs = mockPrisma.user.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty("active");
    });

    it("should return empty array for non-existent venue", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getUsersInVenue("non-existent-venue-id");

      expect(result).toEqual([]);
    });

    it("should handle inactive venue by returning users (if query allows)", async () => {
      // Venue C is inactive but query still returns assigned users
      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user3.id },
        { id: testUsers.user4.id },
      ] as any);

      const result = await getUsersInVenue(testVenues.venueC.id);

      expect(result).toHaveLength(2);
    });

    it("should filter by active status by default", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: testUsers.user1.id },
      ] as any);

      await getUsersInVenue(testVenues.venueB.id);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // usersShareVenue() - Check if two users share venues
  // ==========================================================================
  describe("usersShareVenue()", () => {
    it("should return true when users share active venue", async () => {
      // User 1 has Venue A and Venue B
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        // User 2 has Venue B
        .mockResolvedValueOnce([{ venueId: testVenues.venueB.id }] as any);

      const result = await usersShareVenue(testUsers.user1.id, testUsers.user2.id);

      expect(result).toBe(true);
    });

    it("should return false when users don't share venues", async () => {
      // User 1 has Venue A and Venue B
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        // User 5 has no venues
        .mockResolvedValueOnce([] as any);

      const result = await usersShareVenue(testUsers.user1.id, testUsers.user5.id);

      expect(result).toBe(false);
    });

    it("should return false when one user has no venues", async () => {
      // User 2 has Venue B
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([{ venueId: testVenues.venueB.id }] as any)
        // User 5 has no venues
        .mockResolvedValueOnce([] as any);

      const result = await usersShareVenue(testUsers.user2.id, testUsers.user5.id);

      expect(result).toBe(false);
    });

    it("should return false when both users have no venues", async () => {
      // Both users have no venues
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      const result = await usersShareVenue(testUsers.user5.id, "another-user-no-venues");

      expect(result).toBe(false);
    });

    it("should return false when only inactive venue is shared", async () => {
      // User 3 has Venue A (active) - getUserVenueIds filters inactive
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any)
        // User 4 has no active venues (Venue C is inactive)
        .mockResolvedValueOnce([] as any);

      const result = await usersShareVenue(testUsers.user3.id, testUsers.user4.id);

      expect(result).toBe(false);
    });

    it("should check venue intersection correctly", async () => {
      // User 1 has Venue A and Venue B
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        // User 3 has Venue A
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any);

      const result = await usersShareVenue(testUsers.user1.id, testUsers.user3.id);

      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // getSharedVenues() - Get venues shared by multiple users
  // ==========================================================================
  describe("getSharedVenues()", () => {
    it("should return venues shared by all users", async () => {
      // User 1 has Venue A and Venue B
      // User 3 has Venue A
      // Shared: Venue A
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any);

      const result = await getSharedVenues([testUsers.user1.id, testUsers.user3.id]);

      expect(result).toHaveLength(1);
      expect(result).toContain(testVenues.venueA.id);
    });

    it("should return empty array when no shared venues", async () => {
      // User 1 has Venue A and Venue B
      // User 2 has Venue B
      // User 3 has Venue A
      // No venue shared by all three
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        .mockResolvedValueOnce([{ venueId: testVenues.venueB.id }] as any)
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any);

      const result = await getSharedVenues([
        testUsers.user1.id,
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      expect(result).toEqual([]);
    });

    it("should handle array of 2 users", async () => {
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        .mockResolvedValueOnce([{ venueId: testVenues.venueB.id }] as any);

      const result = await getSharedVenues([testUsers.user1.id, testUsers.user2.id]);

      expect(result).toContain(testVenues.venueB.id);
    });

    it("should handle array of 3+ users", async () => {
      // Admin, User 1, and User 3 all have Venue A
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        .mockResolvedValueOnce([
          { venueId: testVenues.venueA.id },
          { venueId: testVenues.venueB.id },
        ] as any)
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any);

      const result = await getSharedVenues([
        testUsers.admin.id,
        testUsers.user1.id,
        testUsers.user3.id,
      ]);

      expect(result).toContain(testVenues.venueA.id);
    });

    it("should exclude inactive venues", async () => {
      // getUserVenueIds filters inactive venues automatically
      // User 3 has Venue A (active) and Venue C (inactive)
      // Only Venue A should be considered
      mockPrisma.userVenue.findMany
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any)
        .mockResolvedValueOnce([{ venueId: testVenues.venueA.id }] as any);

      const result = await getSharedVenues([testUsers.user1.id, testUsers.user3.id]);

      expect(result).toContain(testVenues.venueA.id);
      expect(result).not.toContain(testVenues.venueC.id);
    });

    it("should return empty array for empty user array", async () => {
      const result = await getSharedVenues([]);

      expect(result).toEqual([]);
    });

    it("should return user venues for single user array", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValueOnce([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await getSharedVenues([testUsers.user1.id]);

      expect(result).toHaveLength(2);
      expect(result).toContain(testVenues.venueA.id);
      expect(result).toContain(testVenues.venueB.id);
    });
  });

  // ==========================================================================
  // addVenueFilterForUser() - Add venue filter for user data queries
  // ==========================================================================
  describe("addVenueFilterForUser()", () => {
    it("should return correct where clause with default target field", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await addVenueFilterForUser(testUsers.user1.id);

      expect(result).toEqual({
        user: {
          venues: {
            some: {
              venueId: {
                in: [testVenues.venueA.id, testVenues.venueB.id],
              },
            },
          },
        },
      });
    });

    it("should return correct where clause with custom target field", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueB.id },
      ] as any);

      const result = await addVenueFilterForUser(testUsers.user2.id, "author");

      expect(result).toEqual({
        author: {
          venues: {
            some: {
              venueId: {
                in: [testVenues.venueB.id],
              },
            },
          },
        },
      });
    });

    it("should handle user with no venues", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await addVenueFilterForUser(testUsers.user5.id);

      expect(result).toEqual({
        user: {
          id: "impossible-id-no-venues",
        },
      });
    });

    it("should handle custom field with no venues", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await addVenueFilterForUser(testUsers.user5.id, "sender");

      expect(result).toEqual({
        sender: {
          id: "impossible-id-no-venues",
        },
      });
    });

    it("should return correct structure for Prisma queries", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      const result = await addVenueFilterForUser(testUsers.user3.id, "participant");

      expect(result).toHaveProperty("participant.venues.some.venueId.in");
      expect(Array.isArray(result.participant.venues.some.venueId.in)).toBe(true);
    });

    it("should work with different field names", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        { venueId: testVenues.venueA.id },
      ] as any);

      const resultOwner = await addVenueFilterForUser(testUsers.user1.id, "owner");
      const resultCreator = await addVenueFilterForUser(testUsers.user1.id, "creator");
      const resultMember = await addVenueFilterForUser(testUsers.user1.id, "member");

      expect(resultOwner).toHaveProperty("owner.venues");
      expect(resultCreator).toHaveProperty("creator.venues");
      expect(resultMember).toHaveProperty("member.venues");
    });
  });

  // ==========================================================================
  // getUserVenueStats() - Get venue statistics for a user
  // ==========================================================================
  describe("getUserVenueStats()", () => {
    it("should return correct stats for user with multiple venues", async () => {
      // User 1 has Venue A (primary, active) and Venue B (active)
      mockPrisma.userVenue.findMany.mockResolvedValue([
        {
          isPrimary: true,
          venue: {
            id: testVenues.venueA.id,
            name: testVenues.venueA.name,
            code: testVenues.venueA.code,
            active: true,
          },
        },
        {
          isPrimary: false,
          venue: {
            id: testVenues.venueB.id,
            name: testVenues.venueB.name,
            code: testVenues.venueB.code,
            active: true,
          },
        },
      ] as any);

      const result = await getUserVenueStats(testUsers.user1.id);

      expect(result.totalVenues).toBe(2);
      expect(result.activeVenues).toBe(2);
      expect(result.inactiveVenues).toBe(0);
      expect(result.primaryVenue).toEqual({
        id: testVenues.venueA.id,
        name: testVenues.venueA.name,
        code: testVenues.venueA.code,
        active: true,
      });
      expect(result.venues).toHaveLength(2);
    });

    it("should return correct total, active, inactive counts", async () => {
      // User 3 has Venue A (active) and Venue C (inactive)
      mockPrisma.userVenue.findMany.mockResolvedValue([
        {
          isPrimary: true,
          venue: {
            id: testVenues.venueA.id,
            name: testVenues.venueA.name,
            code: testVenues.venueA.code,
            active: true,
          },
        },
        {
          isPrimary: false,
          venue: {
            id: testVenues.venueC.id,
            name: testVenues.venueC.name,
            code: testVenues.venueC.code,
            active: false,
          },
        },
      ] as any);

      const result = await getUserVenueStats(testUsers.user3.id);

      expect(result.totalVenues).toBe(2);
      expect(result.activeVenues).toBe(1);
      expect(result.inactiveVenues).toBe(1);
    });

    it("should identify primary venue correctly", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        {
          isPrimary: false,
          venue: {
            id: testVenues.venueA.id,
            name: testVenues.venueA.name,
            code: testVenues.venueA.code,
            active: true,
          },
        },
        {
          isPrimary: true,
          venue: {
            id: testVenues.venueB.id,
            name: testVenues.venueB.name,
            code: testVenues.venueB.code,
            active: true,
          },
        },
      ] as any);

      const result = await getUserVenueStats(testUsers.user2.id);

      expect(result.primaryVenue).toEqual({
        id: testVenues.venueB.id,
        name: testVenues.venueB.name,
        code: testVenues.venueB.code,
        active: true,
      });
    });

    it("should return zero stats for user with no venues", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([]);

      const result = await getUserVenueStats(testUsers.user5.id);

      expect(result.totalVenues).toBe(0);
      expect(result.activeVenues).toBe(0);
      expect(result.inactiveVenues).toBe(0);
      expect(result.primaryVenue).toBeNull();
      expect(result.venues).toEqual([]);
    });

    it("should include isPrimary flag in venue objects", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        {
          isPrimary: true,
          venue: {
            id: testVenues.venueA.id,
            name: testVenues.venueA.name,
            code: testVenues.venueA.code,
            active: true,
          },
        },
        {
          isPrimary: false,
          venue: {
            id: testVenues.venueB.id,
            name: testVenues.venueB.name,
            code: testVenues.venueB.code,
            active: true,
          },
        },
      ] as any);

      const result = await getUserVenueStats(testUsers.user1.id);

      expect(result.venues[0]).toHaveProperty("isPrimary", true);
      expect(result.venues[1]).toHaveProperty("isPrimary", false);
    });

    it("should handle user with only inactive venues", async () => {
      mockPrisma.userVenue.findMany.mockResolvedValue([
        {
          isPrimary: true,
          venue: {
            id: testVenues.venueC.id,
            name: testVenues.venueC.name,
            code: testVenues.venueC.code,
            active: false,
          },
        },
      ] as any);

      const result = await getUserVenueStats(testUsers.user4.id);

      expect(result.totalVenues).toBe(1);
      expect(result.activeVenues).toBe(0);
      expect(result.inactiveVenues).toBe(1);
      expect(result.primaryVenue).toEqual({
        id: testVenues.venueC.id,
        name: testVenues.venueC.name,
        code: testVenues.venueC.code,
        active: false,
      });
    });
  });

  // ==========================================================================
  // formatVenueName() - Format venue name with primary indicator
  // ==========================================================================
  describe("formatVenueName()", () => {
    it("should format primary venue with indicator", () => {
      const result = formatVenueName("Venue A", true);
      expect(result).toBe("Venue A (Primary)");
    });

    it("should format non-primary venue without indicator", () => {
      const result = formatVenueName("Venue B", false);
      expect(result).toBe("Venue B");
    });

    it("should handle empty venue name", () => {
      const result = formatVenueName("", true);
      expect(result).toBe(" (Primary)");
    });

    it("should handle venue names with special characters", () => {
      const result = formatVenueName("Venue & Lounge #1", false);
      expect(result).toBe("Venue & Lounge #1");
    });

    it("should handle long venue names", () => {
      const longName = "Very Long Venue Name That Might Be Used In Real Application";
      const result = formatVenueName(longName, true);
      expect(result).toBe(`${longName} (Primary)`);
    });
  });

  // ==========================================================================
  // getVenueBadgeColor() - Get badge color for venue status
  // ==========================================================================
  describe("getVenueBadgeColor()", () => {
    it("should return gray for inactive venues", () => {
      const result = getVenueBadgeColor(false, false);
      expect(result).toBe("bg-gray-100 text-gray-600 border-gray-300");
    });

    it("should return gray for inactive primary venues", () => {
      const result = getVenueBadgeColor(false, true);
      expect(result).toBe("bg-gray-100 text-gray-600 border-gray-300");
    });

    it("should return blue for active primary venues", () => {
      const result = getVenueBadgeColor(true, true);
      expect(result).toBe("bg-blue-100 text-blue-700 border-blue-300");
    });

    it("should return green for active non-primary venues", () => {
      const result = getVenueBadgeColor(true, false);
      expect(result).toBe("bg-green-100 text-green-700 border-green-300");
    });

    it("should prioritize inactive status over primary status", () => {
      // Even if primary, inactive should return gray
      const result = getVenueBadgeColor(false, true);
      expect(result).toBe("bg-gray-100 text-gray-600 border-gray-300");
    });

    it("should return valid Tailwind classes", () => {
      const colors = [
        getVenueBadgeColor(true, true),
        getVenueBadgeColor(true, false),
        getVenueBadgeColor(false, true),
        getVenueBadgeColor(false, false),
      ];

      colors.forEach((color) => {
        expect(color).toMatch(/^bg-\w+-\d+/);
        expect(color).toMatch(/text-\w+-\d+/);
        expect(color).toMatch(/border-\w+-\d+/);
      });
    });
  });
});
