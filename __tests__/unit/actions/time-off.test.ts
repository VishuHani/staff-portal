/**
 * Time-Off Actions Tests
 *
 * Comprehensive tests for venue-filtered time-off request actions.
 * Tests cover all CRUD operations with proper venue isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testUsers,
  testVenues,
  testUserVenues,
  createTimeOffRequestFixture,
  type TimeOffRequest,
} from "../../helpers/fixtures";
import { createMockPrisma } from "../../helpers/db";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: createMockPrisma(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/notifications", () => ({
  notifyTimeOffSubmitted: vi.fn(),
  notifyTimeOffApproved: vi.fn(),
  notifyTimeOffRejected: vi.fn(),
  notifyTimeOffCancelled: vi.fn(),
}));

// Import after mocks are set up
import * as timeOffActions from "@/lib/actions/time-off";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as notifications from "@/lib/services/notifications";

// Mock RBAC functions
const { mockRequireAuth, mockCanAccess } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockCanAccess: vi.fn(),
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: mockRequireAuth,
  canAccess: mockCanAccess,
}));

// Mock venue utility
const { mockGetSharedVenueUsers } = vi.hoisted(() => ({
  mockGetSharedVenueUsers: vi.fn(),
}));

vi.mock("@/lib/utils/venue", () => ({
  getSharedVenueUsers: mockGetSharedVenueUsers,
}));

// ============================================================================
// TEST DATA
// ============================================================================

const createMockTimeOffRequest = (overrides?: Partial<TimeOffRequest>) => {
  const baseRequest = createTimeOffRequestFixture(overrides);
  return {
    ...baseRequest,
    type: "UNAVAILABLE" as const,
    notes: null,
    reviewedBy: baseRequest.reviewedById,
  };
};

// Time-off requests for testing (using CUID-like IDs)
const timeOffRequests = {
  // User 1's requests (Venue A, B)
  user1Pending: createMockTimeOffRequest({
    id: "clh3k4n0000001bm9e8xh5c92",
    userId: testUsers.user1.id,
    status: "PENDING",
    startDate: new Date("2025-12-01"),
    endDate: new Date("2025-12-05"),
    reason: "Family vacation planned for December",
  }),
  user1Approved: createMockTimeOffRequest({
    id: "clh3k4n0000002bm9e8xh5c93",
    userId: testUsers.user1.id,
    status: "APPROVED",
    startDate: new Date("2025-11-15"),
    endDate: new Date("2025-11-16"),
    reason: "Doctor appointment on the 15th",
    reviewedBy: testUsers.user3.id,
    reviewedAt: new Date("2025-11-01"),
  }),
  // User 2's requests (Venue B)
  user2Pending: createMockTimeOffRequest({
    id: "clh3k4n0000003bm9e8xh5c94",
    userId: testUsers.user2.id,
    status: "PENDING",
    startDate: new Date("2025-12-10"),
    endDate: new Date("2025-12-15"),
    reason: "Holiday travel to visit relatives",
  }),
  // User 3's requests (Venue A - Manager)
  user3Pending: createMockTimeOffRequest({
    id: "clh3k4n0000004bm9e8xh5c95",
    userId: testUsers.user3.id,
    status: "PENDING",
    startDate: new Date("2025-12-20"),
    endDate: new Date("2025-12-25"),
    reason: "Christmas holidays with family",
  }),
  // User 4's requests (Venue C - inactive venue)
  user4Pending: createMockTimeOffRequest({
    id: "clh3k4n0000005bm9e8xh5c96",
    userId: testUsers.user4.id,
    status: "PENDING",
    startDate: new Date("2025-12-01"),
    endDate: new Date("2025-12-05"),
    reason: "Year-end vacation plans",
  }),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const setupMockAuth = (user: any) => {
  mockRequireAuth.mockResolvedValue(user);
};

const setupVenueUsers = (userId: string, sharedUserIds: string[]) => {
  mockGetSharedVenueUsers.mockResolvedValue(sharedUserIds);
};

const mockTimeOffRequestFind = (requestId: string, request: any) => {
  (prisma.timeOffRequest.findUnique as any).mockResolvedValue(request);
};

const mockTimeOffRequestFindMany = (requests: any[]) => {
  (prisma.timeOffRequest.findMany as any).mockResolvedValue(requests);
};

const mockTimeOffRequestCreate = (request: any) => {
  (prisma.timeOffRequest.create as any).mockResolvedValue(request);
};

const mockTimeOffRequestUpdate = (request: any) => {
  (prisma.timeOffRequest.update as any).mockResolvedValue(request);
};

const mockTimeOffRequestCount = (count: number) => {
  (prisma.timeOffRequest.count as any).mockResolvedValue(count);
};

const mockTimeOffRequestFindFirst = (request: any) => {
  (prisma.timeOffRequest.findFirst as any).mockResolvedValue(request);
};

const mockUserFindMany = (users: any[]) => {
  (prisma.user.findMany as any).mockResolvedValue(users);
};

// ============================================================================
// TEST SUITE: getAllTimeOffRequests()
// ============================================================================

describe("getAllTimeOffRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if user does not have permission", async () => {
    setupMockAuth(testUsers.user1);
    mockCanAccess.mockResolvedValue(false);

    const result = await timeOffActions.getAllTimeOffRequests();

    expect(result.error).toBe("You don't have permission to view all time-off requests");
    expect(result.requests).toBeUndefined();
  });

  it("should return requests from shared venue users only for manager", async () => {
    // User 3 is manager in Venue A
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    // User 3 shares venues with User 1 (both in Venue A)
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    mockTimeOffRequestFindMany([
      timeOffRequests.user1Pending,
      timeOffRequests.user1Approved,
    ]);

    const result = await timeOffActions.getAllTimeOffRequests();

    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(2);
    expect(result.requests?.[0].userId).toBe(testUsers.user1.id);

    // Verify venue filtering was applied
    const findManyCall = (prisma.timeOffRequest.findMany as any).mock.calls[0][0];
    expect(findManyCall.where.userId.in).toEqual([testUsers.user1.id]);
  });

  it("should exclude requests from other venues", async () => {
    // User 1 is in Venue A and B
    setupMockAuth(testUsers.user1);
    mockCanAccess.mockResolvedValue(true);

    // User 1 shares venues with User 2 (both in Venue B)
    setupVenueUsers(testUsers.user1.id, [testUsers.user2.id]);

    mockTimeOffRequestFindMany([timeOffRequests.user2Pending]);

    const result = await timeOffActions.getAllTimeOffRequests();

    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(1);
    // Should NOT include User 4's request (different venue)
    expect(result.requests?.every(r => r.userId !== testUsers.user4.id)).toBe(true);
  });

  it("should filter by status when specified", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    mockTimeOffRequestFindMany([timeOffRequests.user1Pending]);

    const result = await timeOffActions.getAllTimeOffRequests({ status: "PENDING" });

    expect(result.success).toBe(true);

    const findManyCall = (prisma.timeOffRequest.findMany as any).mock.calls[0][0];
    expect(findManyCall.where.status).toBe("PENDING");
  });

  it("should filter by date range when specified", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    mockTimeOffRequestFindMany([timeOffRequests.user1Pending]);

    const startDate = new Date("2025-12-01");
    const endDate = new Date("2025-12-31");

    const result = await timeOffActions.getAllTimeOffRequests({
      startDate,
      endDate,
    });

    expect(result.success).toBe(true);

    const findManyCall = (prisma.timeOffRequest.findMany as any).mock.calls[0][0];
    expect(findManyCall.where.AND).toBeDefined();
    expect(findManyCall.where.AND).toHaveLength(2);
  });

  it("should return empty array for user with no venues", async () => {
    // User 5 has no venues
    setupMockAuth(testUsers.user5);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user5.id, []);

    mockTimeOffRequestFindMany([]);

    const result = await timeOffActions.getAllTimeOffRequests();

    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(0);
  });

  it("should return requests from all venues for multi-venue manager", async () => {
    // User 1 is in Venue A and B
    setupMockAuth(testUsers.user1);
    mockCanAccess.mockResolvedValue(true);

    // User 1 shares venues with User 2 (Venue B) and User 3 (Venue A)
    setupVenueUsers(testUsers.user1.id, [testUsers.user2.id, testUsers.user3.id]);

    mockTimeOffRequestFindMany([
      timeOffRequests.user2Pending,
      timeOffRequests.user3Pending,
    ]);

    const result = await timeOffActions.getAllTimeOffRequests();

    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(2);

    // Verify includes users from multiple venues
    const userIds = result.requests?.map(r => r.userId);
    expect(userIds).toContain(testUsers.user2.id);
    expect(userIds).toContain(testUsers.user3.id);
  });

  it("should return error for invalid filters", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    const result = await timeOffActions.getAllTimeOffRequests({
      status: "INVALID_STATUS" as any,
    });

    expect(result.error).toBe("Invalid filters");
  });

  it("should handle database errors gracefully", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    (prisma.timeOffRequest.findMany as any).mockRejectedValue(new Error("DB Error"));

    const result = await timeOffActions.getAllTimeOffRequests();

    expect(result.error).toBe("Failed to fetch time-off requests");
  });
});

// ============================================================================
// TEST SUITE: getTimeOffRequestById()
// ============================================================================

describe("getTimeOffRequestById", () => {
  // Note: This function doesn't exist in the current implementation
  // but is listed in requirements. This is a placeholder for when it's implemented.

  it.skip("should return request if user is owner", async () => {
    // Test implementation pending
  });

  it.skip("should return request if manager in same venue", async () => {
    // Test implementation pending
  });

  it.skip("should return error if not authorized", async () => {
    // Test implementation pending
  });

  it.skip("should return error for request from other venue", async () => {
    // Test implementation pending
  });

  it.skip("should include reviewer details", async () => {
    // Test implementation pending
  });
});

// ============================================================================
// TEST SUITE: createTimeOffRequest()
// ============================================================================

describe("createTimeOffRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create request successfully", async () => {
    setupMockAuth(testUsers.user1);

    const newRequest = createMockTimeOffRequest({
      id: "new-request",
      userId: testUsers.user1.id,
      status: "PENDING",
    });

    mockTimeOffRequestFindFirst(null); // No overlapping requests
    mockTimeOffRequestCreate(newRequest);
    setupVenueUsers(testUsers.user1.id, [testUsers.user3.id]);
    mockUserFindMany([{ id: testUsers.user3.id }]);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      type: "UNAVAILABLE",
      reason: "Need time off for personal matters",
    });

    expect(result.success).toBe(true);
    expect(result.request).toBeDefined();
    expect(prisma.timeOffRequest.create).toHaveBeenCalled();
  });

  it("should validate date range - end date before start date", async () => {
    setupMockAuth(testUsers.user1);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-05"),
      endDate: new Date("2025-12-01"),
      type: "UNAVAILABLE",
      reason: "This should fail validation",
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("End date must be on or after start date");
  });

  it("should validate date range - start date in past", async () => {
    setupMockAuth(testUsers.user1);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2020-01-01"),
      endDate: new Date("2020-01-05"),
      type: "UNAVAILABLE",
      reason: "This should fail validation",
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Start date must be today or in the future");
  });

  it("should validate reason - too short", async () => {
    setupMockAuth(testUsers.user1);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      type: "UNAVAILABLE",
      reason: "Short",
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Reason must be at least 10 characters");
  });

  it("should validate reason - too long", async () => {
    setupMockAuth(testUsers.user1);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      type: "UNAVAILABLE",
      reason: "A".repeat(501),
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Reason must be less than 500 characters");
  });

  it("should notify managers in same venues", async () => {
    setupMockAuth(testUsers.user1);

    const newRequest = createMockTimeOffRequest({
      id: "new-request",
      userId: testUsers.user1.id,
    });

    mockTimeOffRequestFindFirst(null);
    mockTimeOffRequestCreate(newRequest);

    // User 1 shares venues with User 3 (manager)
    setupVenueUsers(testUsers.user1.id, [testUsers.user3.id]);
    mockUserFindMany([{ id: testUsers.user3.id }]);

    await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      type: "UNAVAILABLE",
      reason: "Personal time needed for family matters",
    });

    expect(notifications.notifyTimeOffSubmitted).toHaveBeenCalledWith(
      expect.any(String),
      testUsers.user1.id,
      expect.stringContaining("User One"),
      expect.any(Date),
      expect.any(Date),
      [testUsers.user3.id]
    );
  });

  it("should reject overlapping pending request", async () => {
    setupMockAuth(testUsers.user1);

    // Mock existing overlapping request
    mockTimeOffRequestFindFirst(timeOffRequests.user1Pending);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-03"),
      endDate: new Date("2025-12-07"),
      type: "UNAVAILABLE",
      reason: "This overlaps with existing request",
    });

    expect(result.error).toContain("overlapping dates");
    expect(prisma.timeOffRequest.create).not.toHaveBeenCalled();
  });

  it("should reject overlapping approved request", async () => {
    setupMockAuth(testUsers.user1);

    mockTimeOffRequestFindFirst(timeOffRequests.user1Approved);

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-11-15"),
      endDate: new Date("2025-11-17"),
      type: "UNAVAILABLE",
      reason: "This overlaps with approved request",
    });

    expect(result.error).toContain("overlapping dates");
  });

  it("should handle notification failures gracefully", async () => {
    setupMockAuth(testUsers.user1);

    const newRequest = createMockTimeOffRequest({
      id: "new-request",
      userId: testUsers.user1.id,
    });

    mockTimeOffRequestFindFirst(null);
    mockTimeOffRequestCreate(newRequest);
    setupVenueUsers(testUsers.user1.id, [testUsers.user3.id]);
    mockUserFindMany([{ id: testUsers.user3.id }]);

    // Mock notification failure
    (notifications.notifyTimeOffSubmitted as any).mockRejectedValue(
      new Error("Notification error")
    );

    const result = await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      type: "UNAVAILABLE",
      reason: "Request should succeed despite notification failure",
    });

    // Should still succeed
    expect(result.success).toBe(true);
    expect(result.request).toBeDefined();
  });

  it("should revalidate paths after creation", async () => {
    setupMockAuth(testUsers.user1);

    const newRequest = createMockTimeOffRequest({
      id: "new-request",
      userId: testUsers.user1.id,
    });

    mockTimeOffRequestFindFirst(null);
    mockTimeOffRequestCreate(newRequest);
    setupVenueUsers(testUsers.user1.id, []);
    mockUserFindMany([]);

    await timeOffActions.createTimeOffRequest({
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      type: "UNAVAILABLE",
      reason: "Testing path revalidation behavior",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/time-off");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/time-off");
  });
});

// ============================================================================
// TEST SUITE: updateTimeOffRequest()
// ============================================================================

describe("updateTimeOffRequest", () => {
  // Note: This function doesn't exist in the current implementation
  // The actual implementation uses cancelTimeOffRequest instead

  it.skip("should update own pending request successfully", async () => {
    // Test implementation pending
  });

  it.skip("should not allow updating approved/rejected request", async () => {
    // Test implementation pending
  });

  it.skip("should not allow updating other user's request", async () => {
    // Test implementation pending
  });

  it.skip("should validate date range on update", async () => {
    // Test implementation pending
  });
});

// ============================================================================
// TEST SUITE: cancelTimeOffRequest()
// ============================================================================

describe("cancelTimeOffRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should cancel own pending request successfully", async () => {
    setupMockAuth(testUsers.user1);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);

    const cancelledRequest = {
      ...timeOffRequests.user1Pending,
      status: "CANCELLED",
    };
    mockTimeOffRequestUpdate(cancelledRequest);

    setupVenueUsers(testUsers.user1.id, [testUsers.user3.id]);
    mockUserFindMany([{ id: testUsers.user3.id }]);

    const result = await timeOffActions.cancelTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "CANCELLED",
    });

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe("CANCELLED");
    expect(prisma.timeOffRequest.update).toHaveBeenCalled();
  });

  it("should not allow cancelling other user's request", async () => {
    setupMockAuth(testUsers.user1);

    mockTimeOffRequestFind(timeOffRequests.user2Pending.id, timeOffRequests.user2Pending);

    const result = await timeOffActions.cancelTimeOffRequest({
      id: timeOffRequests.user2Pending.id,
      status: "CANCELLED",
    });

    expect(result.error).toBe("You can only cancel your own requests");
    expect(prisma.timeOffRequest.update).not.toHaveBeenCalled();
  });

  it("should not allow cancelling non-pending request", async () => {
    setupMockAuth(testUsers.user1);

    mockTimeOffRequestFind(timeOffRequests.user1Approved.id, timeOffRequests.user1Approved);

    const result = await timeOffActions.cancelTimeOffRequest({
      id: timeOffRequests.user1Approved.id,
      status: "CANCELLED",
    });

    expect(result.error).toBe("You can only cancel pending requests");
    expect(prisma.timeOffRequest.update).not.toHaveBeenCalled();
  });

  it("should return error for non-existent request", async () => {
    setupMockAuth(testUsers.user1);

    const nonExistentId = "clh3k4n0000009bm9e8xh5c99";
    mockTimeOffRequestFind(nonExistentId, null);

    const result = await timeOffActions.cancelTimeOffRequest({
      id: nonExistentId,
      status: "CANCELLED",
    });

    expect(result.error).toBe("Time-off request not found");
  });

  it("should notify managers on cancellation", async () => {
    setupMockAuth(testUsers.user1);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);

    const cancelledRequest = {
      ...timeOffRequests.user1Pending,
      status: "CANCELLED",
    };
    mockTimeOffRequestUpdate(cancelledRequest);

    setupVenueUsers(testUsers.user1.id, [testUsers.user3.id]);
    mockUserFindMany([{ id: testUsers.user3.id }]);

    await timeOffActions.cancelTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "CANCELLED",
    });

    expect(notifications.notifyTimeOffCancelled).toHaveBeenCalledWith(
      expect.any(String),
      testUsers.user1.id,
      expect.stringContaining("User One"),
      expect.any(Date),
      expect.any(Date),
      [testUsers.user3.id]
    );
  });

  it("should revalidate paths after cancellation", async () => {
    setupMockAuth(testUsers.user1);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);

    const cancelledRequest = {
      ...timeOffRequests.user1Pending,
      status: "CANCELLED",
    };
    mockTimeOffRequestUpdate(cancelledRequest);

    setupVenueUsers(testUsers.user1.id, []);
    mockUserFindMany([]);

    await timeOffActions.cancelTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "CANCELLED",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/time-off");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/time-off");
  });
});

// ============================================================================
// TEST SUITE: reviewTimeOffRequest()
// ============================================================================

describe("reviewTimeOffRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow manager to approve request from shared venue user", async () => {
    // User 3 (manager) reviewing User 1's request (both in Venue A)
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);

    // User 3 shares venues with User 1
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const approvedRequest = {
      ...timeOffRequests.user1Pending,
      status: "APPROVED",
      reviewedBy: testUsers.user3.id,
      reviewedAt: new Date(),
      user: testUsers.user1,
    };
    mockTimeOffRequestUpdate(approvedRequest);

    const result = await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "APPROVED",
      notes: "Approved - team coverage is adequate",
    });

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe("APPROVED");
    expect(prisma.timeOffRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: timeOffRequests.user1Pending.id },
        data: expect.objectContaining({
          status: "APPROVED",
          reviewedBy: testUsers.user3.id,
          notes: "Approved - team coverage is adequate",
        }),
      })
    );
  });

  it("should allow manager to reject request from shared venue user", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const rejectedRequest = {
      ...timeOffRequests.user1Pending,
      status: "REJECTED",
      reviewedBy: testUsers.user3.id,
      reviewedAt: new Date(),
      user: testUsers.user1,
    };
    mockTimeOffRequestUpdate(rejectedRequest);

    const result = await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "REJECTED",
      notes: "Insufficient staffing during requested period",
    });

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe("REJECTED");
  });

  it("should not allow reviewing request from other venue", async () => {
    // User 3 (Venue A) trying to review User 4's request (Venue C)
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user4Pending.id, timeOffRequests.user4Pending);

    // User 3 does NOT share venues with User 4
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const result = await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user4Pending.id,
      status: "APPROVED",
    });

    expect(result.error).toBe("You don't have access to this time-off request");
    expect(prisma.timeOffRequest.update).not.toHaveBeenCalled();
  });

  it("should not allow staff to review requests", async () => {
    setupMockAuth(testUsers.user1);
    mockCanAccess.mockResolvedValue(false);

    const result = await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user2Pending.id,
      status: "APPROVED",
    });

    expect(result.error).toBe("You don't have permission to review time-off requests");
  });

  it("should not allow reviewing own request", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user3Pending.id, timeOffRequests.user3Pending);

    // Even though user 3 is a manager, they can't review their own request
    // This is enforced by venue filtering - they should not be in their own shared users
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]); // Does not include self

    const result = await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user3Pending.id,
      status: "APPROVED",
    });

    expect(result.error).toBe("You don't have access to this time-off request");
  });

  it("should not allow reviewing already reviewed request", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Approved.id, timeOffRequests.user1Approved);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const result = await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Approved.id,
      status: "REJECTED",
    });

    expect(result.error).toContain("already been");
    expect(prisma.timeOffRequest.update).not.toHaveBeenCalled();
  });

  it("should update status and add reviewer info", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const approvedRequest = {
      ...timeOffRequests.user1Pending,
      status: "APPROVED",
      reviewedBy: testUsers.user3.id,
      reviewedAt: new Date(),
      user: testUsers.user1,
    };
    mockTimeOffRequestUpdate(approvedRequest);

    await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "APPROVED",
      notes: "Team coverage confirmed",
    });

    expect(prisma.timeOffRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          reviewedBy: testUsers.user3.id,
          reviewedAt: expect.any(Date),
          notes: "Team coverage confirmed",
        }),
      })
    );
  });

  it("should notify requester on approval", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const approvedRequest = {
      ...timeOffRequests.user1Pending,
      status: "APPROVED",
      reviewedBy: testUsers.user3.id,
      reviewedAt: new Date(),
      user: testUsers.user1,
    };
    mockTimeOffRequestUpdate(approvedRequest);

    await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "APPROVED",
    });

    expect(notifications.notifyTimeOffApproved).toHaveBeenCalledWith(
      expect.any(String),
      testUsers.user1.id,
      testUsers.user3.id,
      expect.stringContaining("User Three"),
      expect.any(Date),
      expect.any(Date)
    );
  });

  it("should notify requester on rejection", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const rejectedRequest = {
      ...timeOffRequests.user1Pending,
      status: "REJECTED",
      reviewedBy: testUsers.user3.id,
      reviewedAt: new Date(),
      user: testUsers.user1,
    };
    mockTimeOffRequestUpdate(rejectedRequest);

    await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "REJECTED",
      notes: "Cannot approve due to staffing",
    });

    expect(notifications.notifyTimeOffRejected).toHaveBeenCalledWith(
      expect.any(String),
      testUsers.user1.id,
      testUsers.user3.id,
      expect.stringContaining("User Three"),
      expect.any(Date),
      expect.any(Date),
      "Cannot approve due to staffing"
    );
  });

  it("should return error for non-existent request", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind("clh3k4n0000099bm9e8xh5c99", null);

    const result = await timeOffActions.reviewTimeOffRequest({
      id: "clh3k4n0000099bm9e8xh5c99",
      status: "APPROVED",
    });

    expect(result.error).toBe("Time-off request not found");
  });

  it("should revalidate paths after review", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    mockTimeOffRequestFind(timeOffRequests.user1Pending.id, timeOffRequests.user1Pending);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    const approvedRequest = {
      ...timeOffRequests.user1Pending,
      status: "APPROVED",
      reviewedBy: testUsers.user3.id,
      user: testUsers.user1,
    };
    mockTimeOffRequestUpdate(approvedRequest);

    await timeOffActions.reviewTimeOffRequest({
      id: timeOffRequests.user1Pending.id,
      status: "APPROVED",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/time-off");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/time-off");
  });
});

// ============================================================================
// TEST SUITE: getPendingTimeOffCount()
// ============================================================================

describe("getPendingTimeOffCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return count from shared venue users only for manager", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    // User 3 shares venues with User 1
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    mockTimeOffRequestCount(2);

    const result = await timeOffActions.getPendingTimeOffCount();

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);

    // Verify venue filtering was applied
    const countCall = (prisma.timeOffRequest.count as any).mock.calls[0][0];
    expect(countCall.where.status).toBe("PENDING");
    expect(countCall.where.userId.in).toEqual([testUsers.user1.id]);
  });

  it("should return 0 for staff without permission", async () => {
    setupMockAuth(testUsers.user1);
    mockCanAccess.mockResolvedValue(false);

    const result = await timeOffActions.getPendingTimeOffCount();

    expect(result.count).toBe(0);
    expect(prisma.timeOffRequest.count).not.toHaveBeenCalled();
  });

  it("should exclude counts from other venues", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);

    // User 3 is in Venue A, should not see User 4's requests (Venue C)
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    mockTimeOffRequestCount(1);

    const result = await timeOffActions.getPendingTimeOffCount();

    const countCall = (prisma.timeOffRequest.count as any).mock.calls[0][0];
    expect(countCall.where.userId.in).not.toContain(testUsers.user4.id);
  });

  it("should handle user with no venues", async () => {
    setupMockAuth(testUsers.user5);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user5.id, []);

    mockTimeOffRequestCount(0);

    const result = await timeOffActions.getPendingTimeOffCount();

    expect(result.count).toBe(0);
  });

  it("should handle database errors gracefully", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    (prisma.timeOffRequest.count as any).mockRejectedValue(new Error("DB Error"));

    const result = await timeOffActions.getPendingTimeOffCount();

    expect(result.count).toBe(0);
  });

  it("should count only pending status requests", async () => {
    setupMockAuth(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);
    setupVenueUsers(testUsers.user3.id, [testUsers.user1.id]);

    mockTimeOffRequestCount(3);

    await timeOffActions.getPendingTimeOffCount();

    const countCall = (prisma.timeOffRequest.count as any).mock.calls[0][0];
    expect(countCall.where.status).toBe("PENDING");
  });
});
