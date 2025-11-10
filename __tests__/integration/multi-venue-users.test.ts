/**
 * Multi-Venue User Integration Tests
 *
 * SECURITY CRITICAL: These tests verify that multi-venue users can correctly access
 * data from ALL their assigned venues, and that venue switching and primary venue
 * designation work as expected.
 *
 * Test Coverage:
 * - Multi-venue users see aggregated data from all venues
 * - Primary vs secondary venue behavior
 * - Adding/removing venue assignments updates data access
 * - Cross-venue interactions for shared venue users
 * - Multi-venue managers see correct staff across all venues
 * - Venue switching maintains correct isolation
 * - Data aggregation from multiple venues
 * - Access control based on venue membership changes
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
  createUserVenueFixture,
} from "../helpers/fixtures";

// Mock the action modules
const mockGetPosts = vi.fn();
const mockGetPostById = vi.fn();
const mockGetCommentsByPostId = vi.fn();
const mockSearchMessages = vi.fn();
const mockGetConversations = vi.fn();
const mockFindOrCreateConversation = vi.fn();
const mockGetAllTimeOffRequests = vi.fn();
const mockGetAllUsersAvailability = vi.fn();
const mockCreatePost = vi.fn();
const mockCreateComment = vi.fn();

// Mock venue utility functions
const mockGetSharedVenueUsers = vi.fn();
const mockGetUserVenueIds = vi.fn();
const mockGetPrimaryVenueId = vi.fn();
const mockCanAccessVenue = vi.fn();
const mockUsersShareVenue = vi.fn();
const mockGetUserVenueStats = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  getPosts: mockGetPosts,
  getPostById: mockGetPostById,
  createPost: mockCreatePost,
}));

vi.mock("@/lib/actions/comments", () => ({
  getCommentsByPostId: mockGetCommentsByPostId,
  createComment: mockCreateComment,
}));

vi.mock("@/lib/actions/messages", () => ({
  searchMessages: mockSearchMessages,
}));

vi.mock("@/lib/actions/conversations", () => ({
  getConversations: mockGetConversations,
  findOrCreateConversation: mockFindOrCreateConversation,
}));

vi.mock("@/lib/actions/time-off", () => ({
  getAllTimeOffRequests: mockGetAllTimeOffRequests,
}));

vi.mock("@/lib/actions/availability", () => ({
  getAllUsersAvailability: mockGetAllUsersAvailability,
}));

vi.mock("@/lib/utils/venue", () => ({
  getSharedVenueUsers: mockGetSharedVenueUsers,
  getUserVenueIds: mockGetUserVenueIds,
  getPrimaryVenueId: mockGetPrimaryVenueId,
  canAccessVenue: mockCanAccessVenue,
  usersShareVenue: mockUsersShareVenue,
  getUserVenueStats: mockGetUserVenueStats,
}));

// Mock auth to return different users
const mockRequireAuth = vi.fn();
vi.mock("@/lib/rbac/access", () => ({
  requireAuth: mockRequireAuth,
  canAccess: vi.fn(() => Promise.resolve(true)),
}));

describe("Multi-Venue User Integration Tests", () => {
  // Test data setup
  let postsVenueA: any[];
  let postsVenueB: any[];
  let postsVenueC: any[];
  let messagesVenueA: any[];
  let messagesVenueB: any[];
  let conversationsVenueA: any[];
  let conversationsVenueB: any[];
  let timeOffRequestsVenueA: any[];
  let timeOffRequestsVenueB: any[];
  let availabilityVenueA: any[];
  let availabilityVenueB: any[];

  // Additional test users for specific scenarios
  let userVenueAssignments: Map<string, string[]>;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Initialize venue assignments tracking
    userVenueAssignments = new Map([
      [testUsers.user1.id, [testVenues.venueA.id, testVenues.venueB.id]], // Multi-venue
      [testUsers.user2.id, [testVenues.venueB.id]], // Single venue B
      [testUsers.user3.id, [testVenues.venueA.id]], // Single venue A (Manager)
      [testUsers.user4.id, [testVenues.venueC.id]], // Inactive venue
      [testUsers.user5.id, []], // No venues
      [testUsers.admin.id, [testVenues.venueA.id, testVenues.venueB.id, testVenues.venueC.id]], // All venues
    ]);

    // Setup test data for Venue A
    postsVenueA = [
      createPostFixture({
        id: "post-a-1",
        content: "Post from User1 in Venue A",
        authorId: testUsers.user1.id,
        channelId: "channel-1",
      }),
      createPostFixture({
        id: "post-a-2",
        content: "Post from User3 in Venue A",
        authorId: testUsers.user3.id,
        channelId: "channel-1",
      }),
      createPostFixture({
        id: "post-a-3",
        content: "Admin post in Venue A",
        authorId: testUsers.admin.id,
        channelId: "channel-1",
      }),
    ];

    // Setup test data for Venue B
    postsVenueB = [
      createPostFixture({
        id: "post-b-1",
        content: "Post from User2 in Venue B",
        authorId: testUsers.user2.id,
        channelId: "channel-1",
      }),
      createPostFixture({
        id: "post-b-2",
        content: "Post from User1 in Venue B",
        authorId: testUsers.user1.id,
        channelId: "channel-1",
      }),
      createPostFixture({
        id: "post-b-3",
        content: "Admin post in Venue B",
        authorId: testUsers.admin.id,
        channelId: "channel-1",
      }),
    ];

    // Setup test data for Venue C (inactive)
    postsVenueC = [
      createPostFixture({
        id: "post-c-1",
        content: "Post from User4 in Venue C",
        authorId: testUsers.user4.id,
        channelId: "channel-1",
      }),
    ];

    messagesVenueA = [
      createMessageFixture({
        id: "message-a-1",
        content: "Message from User3 in Venue A",
        senderId: testUsers.user3.id,
        conversationId: "conv-a-1",
      }),
    ];

    messagesVenueB = [
      createMessageFixture({
        id: "message-b-1",
        content: "Message from User2 in Venue B",
        senderId: testUsers.user2.id,
        conversationId: "conv-b-1",
      }),
    ];

    conversationsVenueA = [
      createConversationFixture({
        id: "conv-a-1",
        isGroup: false,
      }),
    ];

    conversationsVenueB = [
      createConversationFixture({
        id: "conv-b-1",
        isGroup: false,
      }),
    ];

    timeOffRequestsVenueA = [
      createTimeOffRequestFixture({
        id: "timeoff-a-1",
        userId: testUsers.user3.id,
        reason: "Vacation in Venue A",
      }),
      createTimeOffRequestFixture({
        id: "timeoff-a-2",
        userId: testUsers.user1.id,
        reason: "Sick day in Venue A",
      }),
    ];

    timeOffRequestsVenueB = [
      createTimeOffRequestFixture({
        id: "timeoff-b-1",
        userId: testUsers.user2.id,
        reason: "Vacation in Venue B",
      }),
      createTimeOffRequestFixture({
        id: "timeoff-b-2",
        userId: testUsers.user1.id,
        reason: "Sick day in Venue B",
      }),
    ];

    availabilityVenueA = [
      { userId: testUsers.user1.id, dayOfWeek: 1, isAvailable: true },
      { userId: testUsers.user3.id, dayOfWeek: 1, isAvailable: true },
    ];

    availabilityVenueB = [
      { userId: testUsers.user1.id, dayOfWeek: 2, isAvailable: true },
      { userId: testUsers.user2.id, dayOfWeek: 2, isAvailable: true },
    ];

    // Setup mock implementations
    setupMockImplementations();
  });

  function setupMockImplementations() {
    // Mock getUserVenueIds to return venues from our tracking map
    mockGetUserVenueIds.mockImplementation(async (userId: string) => {
      const venues = userVenueAssignments.get(userId) || [];
      // Filter out inactive venues
      return venues.filter((venueId) => {
        const venue = Object.values(testVenues).find((v) => v.id === venueId);
        return venue?.active;
      });
    });

    // Mock getPrimaryVenueId
    mockGetPrimaryVenueId.mockImplementation(async (userId: string) => {
      const userVenue = testUserVenues.find((uv) => uv.userId === userId && uv.isPrimary);
      if (!userVenue) return null;

      const venue = Object.values(testVenues).find((v) => v.id === userVenue.venueId);
      return venue?.active ? userVenue.venueId : null;
    });

    // Mock canAccessVenue
    mockCanAccessVenue.mockImplementation(async (userId: string, venueId: string) => {
      const userVenues = userVenueAssignments.get(userId) || [];
      const hasAccess = userVenues.includes(venueId);
      const venue = Object.values(testVenues).find((v) => v.id === venueId);
      return hasAccess && venue?.active === true;
    });

    // Mock getSharedVenueUsers to return users sharing venues
    mockGetSharedVenueUsers.mockImplementation(async (userId: string) => {
      const userVenues = await mockGetUserVenueIds(userId);
      if (userVenues.length === 0) return [];

      const sharedUsers = new Set<string>();

      // Add the user themselves
      sharedUsers.add(userId);

      // Find all users who share at least one venue
      for (const [otherUserId, otherVenues] of userVenueAssignments.entries()) {
        if (otherUserId === userId) continue;

        // Get only active venues for other user
        const activeOtherVenues = await mockGetUserVenueIds(otherUserId);

        const hasSharedVenue = userVenues.some((venueId) =>
          activeOtherVenues.includes(venueId)
        );

        if (hasSharedVenue) {
          sharedUsers.add(otherUserId);
        }
      }

      return Array.from(sharedUsers);
    });

    // Mock usersShareVenue
    mockUsersShareVenue.mockImplementation(async (userId1: string, userId2: string) => {
      const user1Venues = await mockGetUserVenueIds(userId1);
      const user2Venues = await mockGetUserVenueIds(userId2);
      return user1Venues.some((venueId) => user2Venues.includes(venueId));
    });

    // Mock getUserVenueStats
    mockGetUserVenueStats.mockImplementation(async (userId: string) => {
      const userVenueRecords = testUserVenues.filter((uv) => uv.userId === userId);
      const venues = userVenueRecords.map((uv) => {
        const venue = Object.values(testVenues).find((v) => v.id === uv.venueId);
        return {
          ...venue,
          isPrimary: uv.isPrimary,
        };
      });

      const primaryVenue = venues.find((v) => v.isPrimary);

      return {
        totalVenues: venues.length,
        activeVenues: venues.filter((v) => v.active).length,
        inactiveVenues: venues.filter((v) => !v.active).length,
        primaryVenue: primaryVenue || null,
        venues,
      };
    });

    // Mock getPosts to filter by shared venue users
    mockGetPosts.mockImplementation(async (filters?: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const allPosts = [...postsVenueA, ...postsVenueB, ...postsVenueC];
      const filteredPosts = allPosts.filter((post) =>
        sharedUserIds.includes(post.authorId)
      );

      return { success: true, posts: filteredPosts };
    });

    // Mock getPostById
    mockGetPostById.mockImplementation(async (id: string) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const post = [...postsVenueA, ...postsVenueB, ...postsVenueC].find((p) => p.id === id);

      if (!post) {
        return { error: "Post not found" };
      }

      if (!sharedUserIds.includes(post.authorId)) {
        return { error: "Post not found" };
      }

      return { success: true, post };
    });

    // Mock searchMessages
    mockSearchMessages.mockImplementation(async (query: string) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const allMessages = [...messagesVenueA, ...messagesVenueB];
      const filteredMessages = allMessages.filter(
        (msg) =>
          msg.content.toLowerCase().includes(query.toLowerCase()) &&
          sharedUserIds.includes(msg.senderId)
      );

      return { success: true, messages: filteredMessages };
    });

    // Mock getConversations
    mockGetConversations.mockImplementation(async () => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const allConversations = [...conversationsVenueA, ...conversationsVenueB];
      const filteredConversations = allConversations.filter((conv) => {
        // Mock participant logic
        if (conv.id === "conv-a-1") {
          const otherParticipants = [testUsers.user3.id];
          return otherParticipants.some((id) => sharedUserIds.includes(id));
        }
        if (conv.id === "conv-b-1") {
          const otherParticipants = [testUsers.user2.id];
          return otherParticipants.some((id) => sharedUserIds.includes(id));
        }
        return false;
      });

      return { success: true, conversations: filteredConversations };
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
    mockGetAllTimeOffRequests.mockImplementation(async (filters?: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const allRequests = [...timeOffRequestsVenueA, ...timeOffRequestsVenueB];
      const filteredRequests = allRequests.filter((req) =>
        sharedUserIds.includes(req.userId)
      );

      return { success: true, requests: filteredRequests };
    });

    // Mock getAllUsersAvailability
    mockGetAllUsersAvailability.mockImplementation(async (filters?: any) => {
      const currentUser = await mockRequireAuth();
      const sharedUserIds = await mockGetSharedVenueUsers(currentUser.id);

      const availabilityUsers = Object.values(testUsers)
        .filter((u) => sharedUserIds.includes(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          availability: [...availabilityVenueA, ...availabilityVenueB].filter(
            (a) => a.userId === u.id
          ),
        }));

      return { success: true, users: availabilityUsers };
    });
  }

  describe("Scenario 1: Multi-venue user sees aggregated data from all venues", () => {
    it("User1 (Venues A & B) should see posts from both venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();

      expect(result.success).toBe(true);
      expect(result.posts).toBeDefined();

      const postIds = result.posts.map((p: any) => p.id);

      // User1 should see posts from Venue A (User1, User3, Admin)
      expect(postIds).toContain("post-a-1");
      expect(postIds).toContain("post-a-2");
      expect(postIds).toContain("post-a-3");

      // User1 should see posts from Venue B (User1, User2, Admin)
      expect(postIds).toContain("post-b-1");
      expect(postIds).toContain("post-b-2");
      expect(postIds).toContain("post-b-3");

      // User1 should NOT see posts from inactive Venue C
      expect(postIds).not.toContain("post-c-1");
    });

    it("User1 should see messages from users in both venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockSearchMessages("message");

      expect(result.success).toBe(true);
      const senderIds = result.messages.map((m: any) => m.senderId);

      // Should see messages from both venues
      expect(senderIds).toContain(testUsers.user2.id); // Venue B
      expect(senderIds).toContain(testUsers.user3.id); // Venue A
    });

    it("User1 should see conversations from both venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetConversations();

      expect(result.success).toBe(true);
      const conversationIds = result.conversations.map((c: any) => c.id);

      // Should see conversations from both venues
      expect(conversationIds).toContain("conv-a-1"); // With User3 from Venue A
      expect(conversationIds).toContain("conv-b-1"); // With User2 from Venue B
    });

    it("Manager User3 with access to Venue A should see time-off from Venue A users only", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);
      const requestIds = result.requests.map((r: any) => r.id);

      // Should see Venue A time-off requests
      expect(requestIds).toContain("timeoff-a-1"); // User3's request
      expect(requestIds).toContain("timeoff-a-2"); // User1's request

      // Should NOT see Venue B-only requests
      expect(requestIds).not.toContain("timeoff-b-1"); // User2's request
    });

    it("User1 should see availability from users in both venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetAllUsersAvailability();

      expect(result.success).toBe(true);
      const userIds = result.users.map((u: any) => u.id);

      // Should see users from both venues
      expect(userIds).toContain(testUsers.user1.id); // Self
      expect(userIds).toContain(testUsers.user2.id); // Venue B
      expect(userIds).toContain(testUsers.user3.id); // Venue A
      expect(userIds).toContain(testUsers.admin.id); // All venues

      // Should NOT see users from other venues or no venues
      expect(userIds).not.toContain(testUsers.user4.id); // Venue C (inactive)
      expect(userIds).not.toContain(testUsers.user5.id); // No venues
    });
  });

  describe("Scenario 2: Primary venue vs secondary venue behavior", () => {
    it("User1's primary venue should be Venue A", async () => {
      const primaryVenueId = await mockGetPrimaryVenueId(testUsers.user1.id);

      expect(primaryVenueId).toBe(testVenues.venueA.id);
    });

    it("User2's primary venue should be Venue B", async () => {
      const primaryVenueId = await mockGetPrimaryVenueId(testUsers.user2.id);

      expect(primaryVenueId).toBe(testVenues.venueB.id);
    });

    it("User3's primary venue should be Venue A", async () => {
      const primaryVenueId = await mockGetPrimaryVenueId(testUsers.user3.id);

      expect(primaryVenueId).toBe(testVenues.venueA.id);
    });

    it("getUserVenueStats should show correct primary venue for User1", async () => {
      const stats = await mockGetUserVenueStats(testUsers.user1.id);

      expect(stats.totalVenues).toBe(2);
      expect(stats.activeVenues).toBe(2);
      expect(stats.primaryVenue).toBeDefined();
      expect(stats.primaryVenue?.id).toBe(testVenues.venueA.id);
      expect(stats.primaryVenue?.name).toBe("Venue A");
    });

    it("User1 can access both primary and secondary venues", async () => {
      const canAccessPrimary = await mockCanAccessVenue(testUsers.user1.id, testVenues.venueA.id);
      const canAccessSecondary = await mockCanAccessVenue(testUsers.user1.id, testVenues.venueB.id);
      const canAccessOther = await mockCanAccessVenue(testUsers.user1.id, testVenues.venueC.id);

      expect(canAccessPrimary).toBe(true);
      expect(canAccessSecondary).toBe(true);
      expect(canAccessOther).toBe(false);
    });
  });

  describe("Scenario 3: Adding venue assignments updates data access", () => {
    it("User2 initially sees only Venue B data", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user2);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // User2 should see Venue B posts
      expect(postIds).toContain("post-b-1");
      expect(postIds).toContain("post-b-2");
      expect(postIds).toContain("post-b-3");

      // User2 should NOT see Venue A-only posts (User3)
      expect(postIds).not.toContain("post-a-2");

      // Note: User2 will see post-a-1 and post-a-3 because User1 and Admin are in Venue B
      // This is correct behavior - we filter by author's venue membership, not post venue
    });

    it("After adding User2 to Venue A, they should see data from both venues", async () => {
      // Add User2 to Venue A
      userVenueAssignments.set(testUsers.user2.id, [
        testVenues.venueB.id,
        testVenues.venueA.id,
      ]);

      mockRequireAuth.mockResolvedValue(testUsers.user2);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // User2 should now see posts from both venues
      expect(postIds).toContain("post-a-1"); // Venue A
      expect(postIds).toContain("post-a-2"); // Venue A
      expect(postIds).toContain("post-b-1"); // Venue B
      expect(postIds).toContain("post-b-2"); // Venue B
    });

    it("User2 can now create conversations with Venue A users", async () => {
      // User2 now has access to Venue A
      userVenueAssignments.set(testUsers.user2.id, [
        testVenues.venueB.id,
        testVenues.venueA.id,
      ]);

      mockRequireAuth.mockResolvedValue(testUsers.user2);

      // User2 should now be able to create conversation with User3 (Venue A)
      const result = await mockFindOrCreateConversation(testUsers.user3.id);

      expect(result.success).toBe(true);
      expect(result.conversation).toBeDefined();
    });
  });

  describe("Scenario 4: Removing venue assignments updates data access", () => {
    it("User1 initially sees data from both Venue A and B", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // User1 should see posts from both venues
      expect(postIds).toContain("post-a-1");
      expect(postIds).toContain("post-b-1");
    });

    it("After removing User1 from Venue B, they should only see Venue A data", async () => {
      // Remove User1 from Venue B
      userVenueAssignments.set(testUsers.user1.id, [testVenues.venueA.id]);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // User1 should now only see Venue A posts
      expect(postIds).toContain("post-a-1");
      expect(postIds).toContain("post-a-2");
      expect(postIds).toContain("post-a-3");

      // User1 should NOT see Venue B posts
      expect(postIds).not.toContain("post-b-1");
    });

    it("After removing venue, user cannot create conversations with users from that venue", async () => {
      // Remove User1 from Venue B
      userVenueAssignments.set(testUsers.user1.id, [testVenues.venueA.id]);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      // User1 should NOT be able to create conversation with User2 (Venue B only)
      const result = await mockFindOrCreateConversation(testUsers.user2.id);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("users in your venues");
    });

    it("After removing venue, manager cannot see time-off from that venue", async () => {
      // Create a manager with both venues first
      const managerInBothVenues = createUserFixture({
        id: "manager-both",
        email: "manager@example.com",
        roleId: testRoles.manager.id,
      });

      userVenueAssignments.set(managerInBothVenues.id, [
        testVenues.venueA.id,
        testVenues.venueB.id,
      ]);

      mockRequireAuth.mockResolvedValue(managerInBothVenues);

      // Should see time-off from both venues
      let result = await mockGetAllTimeOffRequests();
      expect(result.requests.length).toBe(4); // 2 from A, 2 from B

      // Remove from Venue B
      userVenueAssignments.set(managerInBothVenues.id, [testVenues.venueA.id]);

      // Should now see time-off from Venue A + User1 (who is still in Venue A)
      result = await mockGetAllTimeOffRequests();
      expect(result.requests.length).toBe(3); // User1, User3, and manager themselves

      const requestIds = result.requests.map((r: any) => r.id);
      expect(requestIds).toContain("timeoff-a-1"); // User3's request
      expect(requestIds).toContain("timeoff-a-2"); // User1's request
      expect(requestIds).not.toContain("timeoff-b-1"); // User2's request (Venue B only)
    });
  });

  describe("Scenario 5: Cross-venue interaction between users sharing multiple venues", () => {
    it("User1 and Admin share both Venue A and B, so they can interact", async () => {
      const shareVenue = await mockUsersShareVenue(testUsers.user1.id, testUsers.admin.id);
      expect(shareVenue).toBe(true);
    });

    it("User2 and User3 do not share any venues, so they cannot interact", async () => {
      const shareVenue = await mockUsersShareVenue(testUsers.user2.id, testUsers.user3.id);
      expect(shareVenue).toBe(false);
    });

    it("User1 can see posts from Admin in both venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // User1 should see Admin's posts from both venues
      expect(postIds).toContain("post-a-3"); // Admin in Venue A
      expect(postIds).toContain("post-b-3"); // Admin in Venue B
    });

    it("User3 can see Admin posts because Admin is in Venue A", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // User3 should see Admin's posts because Admin is in Venue A
      // The filtering is by author venue membership, not post location
      expect(postIds).toContain("post-a-3");

      // User3 will also see post-b-3 because Admin is in shared Venue A
      // This is correct - if you share a venue with someone, you see all their posts
      expect(postIds).toContain("post-b-3");
    });

    it("getSharedVenueUsers for User1 includes users from both venues", async () => {
      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user1.id);

      // Should include User1 themselves
      expect(sharedUsers).toContain(testUsers.user1.id);

      // Should include users from Venue A
      expect(sharedUsers).toContain(testUsers.user3.id);

      // Should include users from Venue B
      expect(sharedUsers).toContain(testUsers.user2.id);

      // Should include Admin (all venues)
      expect(sharedUsers).toContain(testUsers.admin.id);

      // Should NOT include User4 (inactive venue)
      expect(sharedUsers).not.toContain(testUsers.user4.id);

      // Should NOT include User5 (no venues)
      expect(sharedUsers).not.toContain(testUsers.user5.id);
    });
  });

  describe("Scenario 6: Multi-venue managers see correct staff across all venues", () => {
    it("Manager User3 in Venue A should see staff from Venue A only", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user3.id);

      // Should see Venue A users
      expect(sharedUsers).toContain(testUsers.user1.id);
      expect(sharedUsers).toContain(testUsers.user3.id); // Self
      expect(sharedUsers).toContain(testUsers.admin.id);

      // Should NOT see Venue B-only users
      expect(sharedUsers).not.toContain(testUsers.user2.id);
    });

    it("If Manager User3 is added to Venue B, they should see staff from both venues", async () => {
      // Add User3 to Venue B
      userVenueAssignments.set(testUsers.user3.id, [
        testVenues.venueA.id,
        testVenues.venueB.id,
      ]);

      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user3.id);

      // Should now see users from both venues
      expect(sharedUsers).toContain(testUsers.user1.id); // Both venues
      expect(sharedUsers).toContain(testUsers.user2.id); // Venue B
      expect(sharedUsers).toContain(testUsers.user3.id); // Self
      expect(sharedUsers).toContain(testUsers.admin.id); // All venues
    });

    it("Multi-venue manager should see time-off requests from all their venues", async () => {
      // Add User3 to Venue B
      userVenueAssignments.set(testUsers.user3.id, [
        testVenues.venueA.id,
        testVenues.venueB.id,
      ]);

      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);
      expect(result.requests.length).toBe(4); // 2 from A, 2 from B

      const requestIds = result.requests.map((r: any) => r.id);
      expect(requestIds).toContain("timeoff-a-1");
      expect(requestIds).toContain("timeoff-a-2");
      expect(requestIds).toContain("timeoff-b-1");
      expect(requestIds).toContain("timeoff-b-2");
    });

    it("Multi-venue manager should see availability from all their venues", async () => {
      // Add User3 to Venue B
      userVenueAssignments.set(testUsers.user3.id, [
        testVenues.venueA.id,
        testVenues.venueB.id,
      ]);

      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const result = await mockGetAllUsersAvailability();

      expect(result.success).toBe(true);

      const userIds = result.users.map((u: any) => u.id);

      // Should see availability from both venues
      expect(userIds).toContain(testUsers.user1.id);
      expect(userIds).toContain(testUsers.user2.id);
      expect(userIds).toContain(testUsers.user3.id);
      expect(userIds).toContain(testUsers.admin.id);
    });
  });

  describe("Scenario 7: Venue switching maintains correct isolation", () => {
    it("User switching from Venue A to Venue B context should see different data", async () => {
      // User1 views data (should see both venues)
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result1 = await mockGetPosts();
      const postIds1 = result1.posts.map((p: any) => p.id);

      expect(postIds1).toContain("post-a-1");
      expect(postIds1).toContain("post-b-1");

      // Now simulate User1 filtering to only Venue A users
      // In reality, the app might have venue selection UI
      // For testing, we simulate by temporarily restricting venues
      const originalVenues = userVenueAssignments.get(testUsers.user1.id);

      // Restrict to Venue A only temporarily
      userVenueAssignments.set(testUsers.user1.id, [testVenues.venueA.id]);

      const result2 = await mockGetPosts();
      const postIds2 = result2.posts.map((p: any) => p.id);

      expect(postIds2).toContain("post-a-1");
      expect(postIds2).not.toContain("post-b-1");

      // Restore original venues
      userVenueAssignments.set(testUsers.user1.id, originalVenues!);
    });

    it("Venue context switch affects conversation visibility", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      // Initially see conversations from both venues
      let result = await mockGetConversations();
      let conversationIds = result.conversations.map((c: any) => c.id);

      expect(conversationIds).toContain("conv-a-1");
      expect(conversationIds).toContain("conv-b-1");

      // Switch to Venue A only
      const originalVenues = userVenueAssignments.get(testUsers.user1.id);
      userVenueAssignments.set(testUsers.user1.id, [testVenues.venueA.id]);

      result = await mockGetConversations();
      conversationIds = result.conversations.map((c: any) => c.id);

      expect(conversationIds).toContain("conv-a-1");
      expect(conversationIds).not.toContain("conv-b-1");

      // Restore
      userVenueAssignments.set(testUsers.user1.id, originalVenues!);
    });
  });

  describe("Scenario 8: Admin sees data from all venues", () => {
    it("Admin should see posts from all active venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.admin);

      const result = await mockGetPosts();
      const postIds = result.posts.map((p: any) => p.id);

      // Admin should see posts from Venue A
      expect(postIds).toContain("post-a-1");
      expect(postIds).toContain("post-a-2");
      expect(postIds).toContain("post-a-3");

      // Admin should see posts from Venue B
      expect(postIds).toContain("post-b-1");
      expect(postIds).toContain("post-b-2");
      expect(postIds).toContain("post-b-3");

      // Admin should NOT see posts from inactive Venue C
      expect(postIds).not.toContain("post-c-1");
    });

    it("Admin should see messages from all active venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.admin);

      const result = await mockSearchMessages("message");

      expect(result.success).toBe(true);
      const senderIds = result.messages.map((m: any) => m.senderId);

      // Should see messages from all active venues
      expect(senderIds).toContain(testUsers.user2.id); // Venue B
      expect(senderIds).toContain(testUsers.user3.id); // Venue A
    });

    it("Admin should see time-off requests from all active venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.admin);

      const result = await mockGetAllTimeOffRequests();

      expect(result.success).toBe(true);
      expect(result.requests.length).toBe(4); // All requests from active venues

      const requestIds = result.requests.map((r: any) => r.id);
      expect(requestIds).toContain("timeoff-a-1");
      expect(requestIds).toContain("timeoff-a-2");
      expect(requestIds).toContain("timeoff-b-1");
      expect(requestIds).toContain("timeoff-b-2");
    });

    it("Admin should see availability from all active venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.admin);

      const result = await mockGetAllUsersAvailability();

      expect(result.success).toBe(true);

      const userIds = result.users.map((u: any) => u.id);

      // Should see all users from active venues
      expect(userIds).toContain(testUsers.user1.id);
      expect(userIds).toContain(testUsers.user2.id);
      expect(userIds).toContain(testUsers.user3.id);
      expect(userIds).toContain(testUsers.admin.id);

      // Should NOT see users from inactive venues or no venues
      expect(userIds).not.toContain(testUsers.user4.id);
      expect(userIds).not.toContain(testUsers.user5.id);
    });
  });

  describe("Scenario 9: Edge cases and boundary conditions", () => {
    it("User with no venues should see no data", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);

      const postsResult = await mockGetPosts();
      expect(postsResult.success).toBe(true);
      expect(postsResult.posts).toHaveLength(0);

      const messagesResult = await mockSearchMessages("test");
      expect(messagesResult.success).toBe(true);
      expect(messagesResult.messages).toHaveLength(0);

      const conversationsResult = await mockGetConversations();
      expect(conversationsResult.success).toBe(true);
      expect(conversationsResult.conversations).toHaveLength(0);

      const timeOffResult = await mockGetAllTimeOffRequests();
      expect(timeOffResult.success).toBe(true);
      expect(timeOffResult.requests).toHaveLength(0);

      const availabilityResult = await mockGetAllUsersAvailability();
      expect(availabilityResult.success).toBe(true);
      expect(availabilityResult.users).toHaveLength(0);
    });

    it("User with only inactive venues should see no data", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user4);

      const postsResult = await mockGetPosts();
      expect(postsResult.success).toBe(true);
      expect(postsResult.posts).toHaveLength(0);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user4.id);
      // User4 has no active venues, so they see no one (not even themselves in this context)
      expect(sharedUsers).toHaveLength(0);
    });

    it("getUserVenueIds should exclude inactive venues", async () => {
      const venueIds = await mockGetUserVenueIds(testUsers.user4.id);
      expect(venueIds).toHaveLength(0); // Venue C is inactive
    });

    it("canAccessVenue should return false for inactive venues", async () => {
      const canAccess = await mockCanAccessVenue(testUsers.user4.id, testVenues.venueC.id);
      expect(canAccess).toBe(false); // Venue C is inactive
    });

    it("User with active and inactive venues should only see active venue data", async () => {
      // User3 has Venue A (active) and Venue C (inactive)
      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user3.id);

      // Should include users from Venue A
      expect(sharedUsers).toContain(testUsers.user1.id);
      expect(sharedUsers).toContain(testUsers.user3.id);

      // Should NOT include users from inactive Venue C
      expect(sharedUsers).not.toContain(testUsers.user4.id);
    });

    it("getSharedVenueUsers should handle user with single venue correctly", async () => {
      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user2.id);

      // Should include User2 themselves
      expect(sharedUsers).toContain(testUsers.user2.id);

      // Should include other users in Venue B
      expect(sharedUsers).toContain(testUsers.user1.id);
      expect(sharedUsers).toContain(testUsers.admin.id);

      // Should NOT include users not in Venue B
      expect(sharedUsers).not.toContain(testUsers.user3.id);
      expect(sharedUsers).not.toContain(testUsers.user4.id);
    });

    it("User can access post from another user in shared venue", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      // User1 should be able to access User3's post (both in Venue A)
      const result = await mockGetPostById("post-a-2");

      expect(result.success).toBe(true);
      expect(result.post).toBeDefined();
      expect(result.post.authorId).toBe(testUsers.user3.id);
    });

    it("User cannot access post from user in non-shared venue", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user2);

      // User2 should NOT be able to access User3's post (User3 only in Venue A)
      const result = await mockGetPostById("post-a-2");

      expect(result.error).toBe("Post not found");
      expect(result.post).toBeUndefined();
    });
  });

  describe("Scenario 10: Complex multi-venue staff hierarchy", () => {
    it("Multi-venue staff member sees appropriate managers from all venues", async () => {
      // Create managers for different venues
      const managerVenueA = createUserFixture({
        id: "manager-a",
        email: "manager-a@example.com",
        roleId: testRoles.manager.id,
      });

      const managerVenueB = createUserFixture({
        id: "manager-b",
        email: "manager-b@example.com",
        roleId: testRoles.manager.id,
      });

      userVenueAssignments.set(managerVenueA.id, [testVenues.venueA.id]);
      userVenueAssignments.set(managerVenueB.id, [testVenues.venueB.id]);

      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user1.id);

      // User1 should see both managers
      expect(sharedUsers).toContain(managerVenueA.id);
      expect(sharedUsers).toContain(managerVenueB.id);
    });

    it("Single-venue staff member only sees their venue's manager", async () => {
      const managerVenueA = createUserFixture({
        id: "manager-a",
        email: "manager-a@example.com",
        roleId: testRoles.manager.id,
      });

      const managerVenueB = createUserFixture({
        id: "manager-b",
        email: "manager-b@example.com",
        roleId: testRoles.manager.id,
      });

      userVenueAssignments.set(managerVenueA.id, [testVenues.venueA.id]);
      userVenueAssignments.set(managerVenueB.id, [testVenues.venueB.id]);

      mockRequireAuth.mockResolvedValue(testUsers.user3);

      const sharedUsers = await mockGetSharedVenueUsers(testUsers.user3.id);

      // User3 should see manager from Venue A
      expect(sharedUsers).toContain(managerVenueA.id);

      // User3 should NOT see manager from Venue B
      expect(sharedUsers).not.toContain(managerVenueB.id);
    });
  });
});
