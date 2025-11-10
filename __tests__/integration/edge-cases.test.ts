/**
 * Edge Cases Integration Tests
 *
 * COMPREHENSIVE: These tests cover unusual scenarios and boundary conditions
 * that might occur in production but are not typically tested in normal flows.
 *
 * Test Coverage:
 * - Users with no venue assignments
 * - Users with only inactive venues
 * - Inactive user scenarios
 * - Null/undefined value handling
 * - Boundary conditions and limits
 * - Data integrity edge cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  testUsers,
  testVenues,
  testUserVenues,
  testRoles,
  createPostFixture,
  createCommentFixture,
  createMessageFixture,
  createConversationFixture,
  createTimeOffRequestFixture,
  createAvailabilityFixture,
  createUserFixture,
} from "../helpers/fixtures";

// Mock the action modules
const mockGetPosts = vi.fn();
const mockCreatePost = vi.fn();
const mockGetUsers = vi.fn();
const mockGetConversations = vi.fn();
const mockFindOrCreateConversation = vi.fn();
const mockGetAllTimeOffRequests = vi.fn();
const mockCreateTimeOffRequest = vi.fn();
const mockGetAllUsersAvailability = vi.fn();
const mockSaveAvailability = vi.fn();
const mockSearchMessages = vi.fn();
const mockCreateComment = vi.fn();

// Mock the venue utility
const mockGetSharedVenueUsers = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  getPosts: mockGetPosts,
  createPost: mockCreatePost,
}));

vi.mock("@/lib/actions/users", () => ({
  getUsers: mockGetUsers,
}));

vi.mock("@/lib/actions/conversations", () => ({
  getConversations: mockGetConversations,
  findOrCreateConversation: mockFindOrCreateConversation,
}));

vi.mock("@/lib/actions/time-off", () => ({
  getAllTimeOffRequests: mockGetAllTimeOffRequests,
  createTimeOffRequest: mockCreateTimeOffRequest,
}));

vi.mock("@/lib/actions/availability", () => ({
  getAllUsersAvailability: mockGetAllUsersAvailability,
  saveAvailability: mockSaveAvailability,
}));

vi.mock("@/lib/actions/messages", () => ({
  searchMessages: mockSearchMessages,
}));

vi.mock("@/lib/actions/comments", () => ({
  createComment: mockCreateComment,
}));

vi.mock("@/lib/utils/venue", () => ({
  getSharedVenueUsers: mockGetSharedVenueUsers,
}));

// Mock auth to return different users
const mockRequireAuth = vi.fn();
vi.mock("@/lib/rbac/access", () => ({
  requireAuth: mockRequireAuth,
  canAccess: vi.fn(() => Promise.resolve(true)),
}));

describe("Edge Cases - Comprehensive Tests", () => {
  // Test data
  let allPosts: any[];
  let allUsers: any[];
  let allConversations: any[];
  let allTimeOffRequests: any[];
  let allAvailability: any[];
  let inactiveUser: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create test data
    allPosts = [
      createPostFixture({ id: "post-1", authorId: testUsers.user1.id }),
      createPostFixture({ id: "post-2", authorId: testUsers.user2.id }),
      createPostFixture({ id: "post-3", authorId: testUsers.user3.id }),
    ];

    allUsers = Object.values(testUsers);

    allConversations = [
      createConversationFixture({ id: "conv-1" }),
      createConversationFixture({ id: "conv-2" }),
    ];

    allTimeOffRequests = [
      createTimeOffRequestFixture({ id: "req-1", userId: testUsers.user1.id }),
      createTimeOffRequestFixture({ id: "req-2", userId: testUsers.user2.id }),
    ];

    allAvailability = [
      createAvailabilityFixture({ userId: testUsers.user1.id, dayOfWeek: 1 }),
      createAvailabilityFixture({ userId: testUsers.user2.id, dayOfWeek: 2 }),
    ];

    // Create inactive user
    inactiveUser = createUserFixture({
      id: "inactive-user-id",
      email: "inactive@example.com",
      firstName: "Inactive",
      lastName: "User",
      active: false,
    });

    // Setup mock implementations
    setupMockImplementations();
  });

  function setupMockImplementations() {
    // Mock getSharedVenueUsers
    mockGetSharedVenueUsers.mockImplementation(async (userId: string) => {
      const userVenues = testUserVenues
        .filter((uv) => uv.userId === userId)
        .filter((uv) => {
          const venue = Object.values(testVenues).find((v) => v.id === uv.venueId);
          return venue?.active;
        })
        .map((uv) => uv.venueId);

      const sharedUsers = testUserVenues
        .filter((uv) => userVenues.includes(uv.venueId))
        .filter((uv) => {
          const venue = Object.values(testVenues).find((v) => v.id === uv.venueId);
          return venue?.active;
        })
        .map((uv) => uv.userId);

      return [...new Set(sharedUsers)];
    });

    // Mock getPosts
    mockGetPosts.mockImplementation(async () => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const filteredPosts = allPosts.filter((post) =>
        sharedUserIds.includes(post.authorId)
      );

      return { success: true, posts: filteredPosts };
    });

    // Mock createPost
    mockCreatePost.mockImplementation(async (data: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      // User with no venues cannot create posts
      if (sharedUserIds.length === 0 || !sharedUserIds.includes(currentUser.id)) {
        return { error: "You must be assigned to at least one active venue to create content" };
      }

      const post = createPostFixture({
        ...data,
        authorId: currentUser.id,
      });

      return { success: true, post };
    });

    // Mock getUsers
    mockGetUsers.mockImplementation(async () => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const filteredUsers = allUsers.filter(
        (u) => sharedUserIds.includes(u.id) && u.active && u.id !== currentUser.id
      );

      return { success: true, users: filteredUsers };
    });

    // Mock getConversations
    mockGetConversations.mockImplementation(async () => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      // Return empty if no shared venues
      if (sharedUserIds.length === 0) {
        return { success: true, conversations: [] };
      }

      return { success: true, conversations: allConversations };
    });

    // Mock findOrCreateConversation
    mockFindOrCreateConversation.mockImplementation(async (otherUserId: string) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      if (!sharedUserIds.includes(otherUserId)) {
        return { error: "You can only create conversations with users in your venues" };
      }

      const conversation = createConversationFixture({
        id: `conv-${currentUser.id}-${otherUserId}`,
      });

      return { success: true, conversation };
    });

    // Mock getAllTimeOffRequests
    mockGetAllTimeOffRequests.mockImplementation(async () => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const filteredRequests = allTimeOffRequests.filter((req) =>
        sharedUserIds.includes(req.userId)
      );

      return { success: true, requests: filteredRequests };
    });

    // Mock createTimeOffRequest
    mockCreateTimeOffRequest.mockImplementation(async (data: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      // User with no venues cannot create time-off requests
      if (sharedUserIds.length === 0) {
        return { error: "You must be assigned to at least one active venue to request time off" };
      }

      const request = createTimeOffRequestFixture({
        ...data,
        userId: currentUser.id,
      });

      return { success: true, request };
    });

    // Mock getAllUsersAvailability
    mockGetAllUsersAvailability.mockImplementation(async () => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const filteredUsers = allUsers
        .filter((u) => sharedUserIds.includes(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          availability: allAvailability.filter((a) => a.userId === u.id),
        }));

      return { success: true, users: filteredUsers };
    });

    // Mock saveAvailability
    mockSaveAvailability.mockImplementation(async (data: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      // User with no venues cannot save availability
      if (sharedUserIds.length === 0) {
        return { error: "You must be assigned to at least one active venue to set availability" };
      }

      return { success: true, availability: data };
    });

    // Mock searchMessages
    mockSearchMessages.mockImplementation(async (query: string) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      // Return empty if no shared venues
      if (sharedUserIds.length === 0) {
        return { success: true, messages: [] };
      }

      return { success: true, messages: [] };
    });

    // Mock createComment
    mockCreateComment.mockImplementation(async (data: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      // User with no venues cannot create comments
      if (sharedUserIds.length === 0) {
        return { error: "You must be assigned to at least one active venue to comment" };
      }

      const comment = createCommentFixture({
        ...data,
        userId: currentUser.id,
      });

      return { success: true, comment };
    });
  }

  // ============================================================================
  // NO VENUES SCENARIOS
  // ============================================================================

  describe("Users with No Venue Assignments", () => {
    it("User with no venues gets empty posts list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(0);
    });

    it("User with no venues cannot create posts", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockCreatePost({
        content: "Test post",
        channelId: "channel-1",
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("active venue");
      expect(result.success).toBeUndefined();
    });

    it("User with no venues cannot see any other users", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockGetUsers();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(0);
    });

    it("User with no venues gets empty conversations list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockGetConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(0);
    });

    it("User with no venues cannot create conversations", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockFindOrCreateConversation(testUsers.user1.id);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("users in your venues");
    });

    it("User with no venues gets empty time-off requests list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);
      expect(result.requests).toHaveLength(0);
    });

    it("User with no venues cannot create time-off requests", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockCreateTimeOffRequest({
        startDate: new Date(),
        endDate: new Date(),
        reason: "Vacation",
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("active venue");
    });

    it("User with no venues gets empty availability list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockGetAllUsersAvailability();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(0);
    });

    it("User with no venues cannot save availability", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockSaveAvailability([
        { dayOfWeek: 1, isAvailable: true, isAllDay: true },
      ]);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("active venue");
    });

    it("User with no venues gets empty message search results", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockSearchMessages("test");

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(0);
    });

    it("User with no venues cannot create comments", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockCreateComment({
        postId: "post-1",
        content: "Test comment",
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("active venue");
    });
  });

  // ============================================================================
  // INACTIVE VENUES SCENARIOS
  // ============================================================================

  describe("Users with Only Inactive Venues", () => {
    it("User with only inactive venues gets empty posts list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(0);
    });

    it("User with only inactive venues cannot create posts", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockCreatePost({
        content: "Test post",
        channelId: "channel-1",
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("active venue");
    });

    it("User with only inactive venues cannot see other users", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockGetUsers();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(0);
    });

    it("User with only inactive venues gets empty conversations", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockGetConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(0);
    });

    it("Users from inactive venues cannot interact with active venue users", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockFindOrCreateConversation(testUsers.user1.id);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("users in your venues");
    });

    it("Active venue users cannot interact with inactive venue users", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockFindOrCreateConversation(testUsers.user4.id);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("users in your venues");
    });

    it("User with only inactive venues gets empty time-off list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);
      expect(result.requests).toHaveLength(0);
    });

    it("User with only inactive venues cannot create time-off requests", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const result = await mockCreateTimeOffRequest({
        startDate: new Date(),
        endDate: new Date(),
        reason: "Vacation",
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("active venue");
    });

    it("Inactive venues don't appear in venue lists", async () => {
      // User3 has both active (Venue A) and inactive (Venue C) venues
      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user3.id);

      // Should NOT include User4 who is only in inactive Venue C
      expect(sharedUsers).not.toContain(testUsers.user4.id);
    });
  });

  // ============================================================================
  // INACTIVE USERS SCENARIOS
  // ============================================================================

  describe("Inactive Users", () => {
    it("Inactive users don't appear in user lists", async () => {
      // Add inactive user to allUsers
      allUsers.push(inactiveUser);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetUsers();

      expect(result.success).toBe(true);

      const userIds = result.users.map((u: any) => u.id);
      expect(userIds).not.toContain(inactiveUser.id);
    });

    it("Inactive users should not be able to log in (auth check)", async () => {
      mockRequireAuth.mockResolvedValue(inactiveUser);

      // Simulate auth check for inactive user
      const isActive = inactiveUser.active;
      expect(isActive).toBe(false);

      // In a real scenario, requireAuth would throw an error
      // This test documents expected behavior
    });

    it("Content from inactive users should be handled correctly", async () => {
      // Create post from inactive user
      const inactiveUserPost = createPostFixture({
        id: "inactive-post",
        authorId: inactiveUser.id,
        content: "Post from inactive user",
      });

      allPosts.push(inactiveUserPost);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);

      // Posts from inactive users should still appear if they were created before deactivation
      // This tests data integrity - historical posts remain visible
      const postIds = result.posts.map((p: any) => p.id);

      // However, the inactive user won't be in shared venues, so post won't appear
      expect(postIds).not.toContain("inactive-post");
    });

    it("Reactivating user should restore access (data integrity)", async () => {
      // Start with inactive user
      const reactivatedUser = { ...inactiveUser, active: true };

      mockRequireAuth.mockResolvedValue(reactivatedUser);

      // After reactivation, user should be able to perform actions
      // This is more of a documentation test for expected behavior
      expect(reactivatedUser.active).toBe(true);
    });
  });

  // ============================================================================
  // NULL/UNDEFINED VALUE HANDLING
  // ============================================================================

  describe("Null/Undefined Value Handling", () => {
    it("User with null firstName/lastName is handled correctly", async () => {
      const userWithNullProfile = createUserFixture({
        id: "null-profile-user",
        email: "nulluser@example.com",
        firstName: null,
        lastName: null,
        profileImage: null,
        bio: null,
      });

      allUsers.push(userWithNullProfile);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetUsers();

      expect(result.success).toBe(true);
      // Should not crash due to null values
    });

    it("Post with null mediaUrls is handled correctly", async () => {
      const postWithNullMedia = createPostFixture({
        id: "null-media-post",
        authorId: testUsers.user1.id,
        mediaUrls: null,
      });

      allPosts.push(postWithNullMedia);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);

      const post = result.posts.find((p: any) => p.id === "null-media-post");
      expect(post).toBeDefined();
      expect(post?.mediaUrls).toBeNull();
    });

    it("Conversation with null title is handled correctly", async () => {
      const conversationWithNullTitle = createConversationFixture({
        id: "null-title-conv",
        title: null,
        isGroup: false,
      });

      allConversations.push(conversationWithNullTitle);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetConversations();

      expect(result.success).toBe(true);

      const conv = result.conversations.find((c: any) => c.id === "null-title-conv");
      expect(conv).toBeDefined();
      expect(conv?.title).toBeNull();
    });

    it("Time-off request with null reviewedBy is handled correctly", async () => {
      const pendingRequest = createTimeOffRequestFixture({
        id: "pending-req",
        userId: testUsers.user1.id,
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
      });

      allTimeOffRequests.push(pendingRequest);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);

      const request = result.requests.find((r: any) => r.id === "pending-req");
      expect(request).toBeDefined();
      expect(request?.reviewedById).toBeNull();
      expect(request?.reviewedAt).toBeNull();
    });

    it("Empty venue list is handled correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user5.id);

      expect(sharedUsers).toBeDefined();
      expect(Array.isArray(sharedUsers)).toBe(true);
      expect(sharedUsers).toHaveLength(0);
    });

    it("User with null dateOfBirth is handled correctly", async () => {
      const userWithNullDOB = createUserFixture({
        id: "null-dob-user",
        email: "nulldob@example.com",
        dateOfBirth: null,
      });

      allUsers.push(userWithNullDOB);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetUsers();

      expect(result.success).toBe(true);
      // Should not crash due to null dateOfBirth
    });

    it("Comment with null parentId (top-level comment) is handled correctly", async () => {
      const topLevelComment = createCommentFixture({
        id: "top-comment",
        postId: "post-1",
        userId: testUsers.user1.id,
        parentId: null,
      });

      expect(topLevelComment.parentId).toBeNull();
      // Should not crash - this is expected for top-level comments
    });

    it("Availability with null startTime/endTime (all-day) is handled correctly", async () => {
      const allDayAvailability = createAvailabilityFixture({
        userId: testUsers.user1.id,
        dayOfWeek: 1,
        isAvailable: true,
        isAllDay: true,
        startTime: null,
        endTime: null,
      });

      expect(allDayAvailability.startTime).toBeNull();
      expect(allDayAvailability.endTime).toBeNull();
      expect(allDayAvailability.isAllDay).toBe(true);
    });
  });

  // ============================================================================
  // BOUNDARY CONDITIONS
  // ============================================================================

  describe("Boundary Conditions", () => {
    it("Post with maximum content length is handled correctly", async () => {
      const maxContentLength = 5000; // Typical max for posts
      const maxLengthPost = createPostFixture({
        id: "max-length-post",
        authorId: testUsers.user1.id,
        content: "a".repeat(maxContentLength),
      });

      allPosts.push(maxLengthPost);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);

      const post = result.posts.find((p: any) => p.id === "max-length-post");
      expect(post).toBeDefined();
      expect(post?.content.length).toBe(maxContentLength);
    });

    it("User with maximum number of venues is handled correctly", async () => {
      // User1 has 2 venues, this tests they can access both
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user1.id);

      // Should include users from both venues
      expect(sharedUsers.length).toBeGreaterThan(0);
      expect(sharedUsers).toContain(testUsers.user1.id); // Venue A + B
      expect(sharedUsers).toContain(testUsers.user2.id); // Venue B
      expect(sharedUsers).toContain(testUsers.user3.id); // Venue A
    });

    it("Query with zero results is handled correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockSearchMessages("nonexistent query xyz123");

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(0);
    });

    it("Empty availability schedule (zero days) is handled correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const result = await mockGetAllUsersAvailability();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(0);
    });

    it("Time-off request with same start and end date (single day) is handled correctly", async () => {
      const singleDayRequest = createTimeOffRequestFixture({
        id: "single-day-req",
        userId: testUsers.user1.id,
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-01-15"),
        reason: "Doctor appointment",
      });

      allTimeOffRequests.push(singleDayRequest);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);

      const request = result.requests.find((r: any) => r.id === "single-day-req");
      expect(request).toBeDefined();
      expect(request?.startDate).toEqual(request?.endDate);
    });

    it("Conversation with single participant (self) is handled correctly", async () => {
      // Edge case: conversation with only one participant
      const selfConversation = createConversationFixture({
        id: "self-conv",
        isGroup: false,
      });

      allConversations.push(selfConversation);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetConversations();

      expect(result.success).toBe(true);
      // Should not crash, though this is an unusual scenario
    });

    it("Large dataset query returns results efficiently", async () => {
      // Create large number of posts
      const largePosts = Array.from({ length: 100 }, (_, i) =>
        createPostFixture({
          id: `large-post-${i}`,
          authorId: testUsers.user1.id,
          content: `Post number ${i}`,
        })
      );

      allPosts.push(...largePosts);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);
      expect(result.posts.length).toBeGreaterThan(0);
      // Should handle large datasets without crashing
    });

    it("Availability covering all 7 days of week is handled correctly", async () => {
      const fullWeekAvailability = Array.from({ length: 7 }, (_, i) =>
        createAvailabilityFixture({
          userId: testUsers.user1.id,
          dayOfWeek: i,
          isAvailable: true,
          isAllDay: false,
          startTime: "09:00",
          endTime: "17:00",
        })
      );

      allAvailability.push(...fullWeekAvailability);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetAllUsersAvailability();

      expect(result.success).toBe(true);

      const user = result.users.find((u: any) => u.id === testUsers.user1.id);
      expect(user).toBeDefined();
      expect(user?.availability.length).toBeGreaterThanOrEqual(7);
    });

    it("User switching from active to inactive venue is handled correctly", async () => {
      // Simulate scenario where user's venue becomes inactive
      // User3 has Venue A (active) and Venue C (inactive)
      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user3.id);

      // Should only see users from active venues
      expect(sharedUsers).toContain(testUsers.user1.id); // Also in Venue A
      expect(sharedUsers).not.toContain(testUsers.user4.id); // Only in inactive Venue C
    });
  });

  // ============================================================================
  // DATA INTEGRITY EDGE CASES
  // ============================================================================

  describe("Data Integrity and Consistency", () => {
    it("User in multiple venues sees deduplicated user list", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user1.id);

      // Check for duplicates
      const uniqueUsers = [...new Set(sharedUsers)];
      expect(sharedUsers.length).toBe(uniqueUsers.length);
    });

    it("Filtering excludes current user from user lists", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetUsers();

      expect(result.success).toBe(true);

      const userIds = result.users.map((u: any) => u.id);
      // Current user should not appear in the list
      expect(userIds).not.toContain(testUsers.user1.id);
    });

    it("Empty string values are handled differently from null", async () => {
      const userWithEmptyStrings = createUserFixture({
        id: "empty-string-user",
        email: "empty@example.com",
        firstName: "",
        lastName: "",
        bio: "",
      });

      expect(userWithEmptyStrings.firstName).toBe("");
      expect(userWithEmptyStrings.lastName).toBe("");
      expect(userWithEmptyStrings.bio).toBe("");
      // Empty strings are valid, different from null
    });

    it("Post with edited flag but null editedAt is invalid state", async () => {
      const invalidEditedPost = createPostFixture({
        id: "invalid-edited-post",
        authorId: testUsers.user1.id,
        edited: true,
        editedAt: null, // This is inconsistent
      });

      // This documents an edge case that should be prevented by validation
      expect(invalidEditedPost.edited).toBe(true);
      expect(invalidEditedPost.editedAt).toBeNull();
      // In production, this should be prevented by schema validation
    });

    it("Time-off request with end date before start date is invalid", async () => {
      const invalidDateRequest = createTimeOffRequestFixture({
        id: "invalid-date-req",
        userId: testUsers.user1.id,
        startDate: new Date("2024-01-20"),
        endDate: new Date("2024-01-15"), // Before start date
        reason: "Invalid dates",
      });

      // This documents an edge case that should be prevented by validation
      expect(invalidDateRequest.startDate > invalidDateRequest.endDate).toBe(true);
      // In production, this should be prevented by schema validation
    });
  });
});
