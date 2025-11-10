/**
 * Comprehensive Unit Tests for Conversation Actions
 *
 * Tests all venue-filtered conversation functions with focus on:
 * - Venue-based access control and data isolation
 * - 1-on-1 vs group conversation handling
 * - Participant management and validation
 * - Multi-venue user support
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues, testRoles } from "../../helpers/fixtures";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock getCurrentUser for auth
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock RBAC access control
const mockRequireAuth = vi.fn();
const mockCanAccess = vi.fn();
vi.mock("@/lib/rbac/access", () => ({
  requireAuth: () => mockRequireAuth(),
  canAccess: (resource: string, action: string) => mockCanAccess(resource, action),
}));

// Mock venue utilities
const mockGetSharedVenueUsers = vi.fn();
vi.mock("@/lib/utils/venue", () => ({
  getSharedVenueUsers: (userId: string, options?: any) =>
    mockGetSharedVenueUsers(userId, options),
}));

// Mock Prisma client
const mockPrisma = vi.hoisted(() => ({
  conversation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  conversationParticipant: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  message: {
    count: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Import actions after mocks
import {
  getConversations,
  getConversationById,
  findOrCreateConversation,
  createGroupConversation,
  addParticipants,
  leaveConversation,
} from "@/lib/actions/conversations";

describe("Conversation Actions - Venue Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to allowing access
    mockCanAccess.mockResolvedValue(true);
    // Default requireAuth to throw - each test should set up its own user
    mockRequireAuth.mockImplementation(async () => {
      const user = await mockGetCurrentUser();
      if (!user) throw new Error("NEXT_REDIRECT: /login");
      if (!user.active) throw new Error("NEXT_REDIRECT: /login?error=inactive");
      return user;
    });
  });

  // ==========================================================================
  // getConversations() - Get all conversations for current user
  // ==========================================================================
  describe("getConversations()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should return only conversations with shared venue users", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const mockConversations = [
        {
          id: "cltestconv1aaaaaaa",
          type: "ONE_ON_ONE",
          name: null,
          lastMessageAt: new Date(),
          participants: [
            {
              userId: mockUser.id,
              user: {
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName,
                profileImage: mockUser.profileImage,
                role: { name: "STAFF" },
              },
            },
            {
              userId: testUsers.user2.id,
              user: {
                id: testUsers.user2.id,
                email: testUsers.user2.email,
                firstName: testUsers.user2.firstName,
                lastName: testUsers.user2.lastName,
                profileImage: testUsers.user2.profileImage,
                role: { name: "STAFF" },
              },
              lastReadAt: new Date(),
            },
          ],
          messages: [],
        },
        {
          id: "cltestconv2bbbbbbb",
          type: "ONE_ON_ONE",
          name: null,
          lastMessageAt: new Date(),
          participants: [
            {
              userId: mockUser.id,
              user: {
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName,
                profileImage: mockUser.profileImage,
                role: { name: "STAFF" },
              },
            },
            {
              userId: testUsers.user5.id, // Not in shared venues
              user: {
                id: testUsers.user5.id,
                email: testUsers.user5.email,
                firstName: testUsers.user5.firstName,
                lastName: testUsers.user5.lastName,
                profileImage: testUsers.user5.profileImage,
                role: { name: "STAFF" },
              },
            },
          ],
          messages: [],
        },
      ];

      mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations![0].id).toBe("cltestconv1aaaaaaa");
      expect(mockGetSharedVenueUsers).toHaveBeenCalled();
      expect(mockGetSharedVenueUsers.mock.calls[0][0]).toBe(mockUser.id);
    });

    it("should filter 1-on-1 conversations correctly", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const mockConversation = {
        id: "cltestconv1aaaaaaa",
        type: "ONE_ON_ONE",
        name: null,
        lastMessageAt: new Date(),
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
            lastReadAt: new Date(),
          },
        ],
        messages: [],
      };

      mockPrisma.conversation.findMany.mockResolvedValue([mockConversation]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations![0].type).toBe("ONE_ON_ONE");
    });

    it("should filter group conversations correctly", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const mockGroupConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        lastMessageAt: new Date(),
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
            lastReadAt: new Date(),
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user3.id,
            user: {
              id: testUsers.user3.id,
              email: testUsers.user3.email,
              firstName: testUsers.user3.firstName,
              lastName: testUsers.user3.lastName,
              profileImage: testUsers.user3.profileImage,
              role: { name: "MANAGER" },
            },
          },
        ],
        messages: [],
      };

      mockPrisma.conversation.findMany.mockResolvedValue([mockGroupConversation]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations![0].type).toBe("GROUP");
      expect(result.conversations![0].name).toBe("Team Chat");
      expect(result.conversations![0].participants).toHaveLength(3);
    });

    it("should include participant details with venue info", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const mockConversation = {
        id: "cltestconv1aaaaaaa",
        type: "ONE_ON_ONE",
        name: null,
        lastMessageAt: new Date(),
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
            lastReadAt: new Date(),
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
        messages: [],
      };

      mockPrisma.conversation.findMany.mockResolvedValue([mockConversation]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await getConversations();

      expect(result.success).toBe(true);
      const participant = result.conversations![0].participants.find(
        (p) => p.userId === testUsers.user2.id
      );
      expect(participant).toBeDefined();
      expect(participant!.user.email).toBe(testUsers.user2.email);
      expect(participant!.user.role.name).toBe("STAFF");
    });

    it("should exclude conversations with users from other venues", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]); // Only user2 shares venue

      const mockConversations = [
        {
          id: "cltestconv1aaaaaaa",
          type: "ONE_ON_ONE",
          name: null,
          lastMessageAt: new Date(),
          participants: [
            {
              userId: mockUser.id,
              user: {
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName,
                profileImage: mockUser.profileImage,
                role: { name: "STAFF" },
              },
            },
            {
              userId: testUsers.user4.id, // Different venue
              user: {
                id: testUsers.user4.id,
                email: testUsers.user4.email,
                firstName: testUsers.user4.firstName,
                lastName: testUsers.user4.lastName,
                profileImage: testUsers.user4.profileImage,
                role: { name: "STAFF" },
              },
            },
          ],
          messages: [],
        },
      ];

      mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(0); // Filtered out
    });

    it("should handle multi-venue user seeing conversations from all their venues", async () => {
      const multiVenueUser = { ...testUsers.admin, active: true, role: testRoles.admin };
      mockGetCurrentUser.mockResolvedValue(multiVenueUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const mockConversations = [
        {
          id: "cltestconv1aaaaaaa",
          type: "ONE_ON_ONE",
          name: null,
          lastMessageAt: new Date(),
          participants: [
            {
              userId: multiVenueUser.id,
              user: {
                id: multiVenueUser.id,
                email: multiVenueUser.email,
                firstName: multiVenueUser.firstName,
                lastName: multiVenueUser.lastName,
                profileImage: multiVenueUser.profileImage,
                role: { name: "ADMIN" },
              },
              lastReadAt: new Date(),
            },
            {
              userId: testUsers.user1.id,
              user: {
                id: testUsers.user1.id,
                email: testUsers.user1.email,
                firstName: testUsers.user1.firstName,
                lastName: testUsers.user1.lastName,
                profileImage: testUsers.user1.profileImage,
                role: { name: "STAFF" },
              },
            },
          ],
          messages: [],
        },
        {
          id: "cltestconv2bbbbbbb",
          type: "ONE_ON_ONE",
          name: null,
          lastMessageAt: new Date(),
          participants: [
            {
              userId: multiVenueUser.id,
              user: {
                id: multiVenueUser.id,
                email: multiVenueUser.email,
                firstName: multiVenueUser.firstName,
                lastName: multiVenueUser.lastName,
                profileImage: multiVenueUser.profileImage,
                role: { name: "ADMIN" },
              },
              lastReadAt: new Date(),
            },
            {
              userId: testUsers.user2.id,
              user: {
                id: testUsers.user2.id,
                email: testUsers.user2.email,
                firstName: testUsers.user2.firstName,
                lastName: testUsers.user2.lastName,
                profileImage: testUsers.user2.profileImage,
                role: { name: "STAFF" },
              },
            },
          ],
          messages: [],
        },
      ];

      mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(2);
    });

    it("should return empty for user with no venues", async () => {
      const noVenueUser = { ...testUsers.user5, active: true, role: testRoles.staff };
      mockGetCurrentUser.mockResolvedValue(noVenueUser);
      mockGetSharedVenueUsers.mockResolvedValue([]); // No shared venue users

      mockPrisma.conversation.findMany.mockResolvedValue([]);

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(0);
    });

    it("should calculate unread count correctly", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const mockConversation = {
        id: "cltestconv1aaaaaaa",
        type: "ONE_ON_ONE",
        name: null,
        lastMessageAt: new Date(),
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
            lastReadAt: new Date(Date.now() - 86400000), // 1 day ago
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
        messages: [],
      };

      mockPrisma.conversation.findMany.mockResolvedValue([mockConversation]);
      mockPrisma.message.count.mockResolvedValue(5); // 5 unread messages

      const result = await getConversations();

      expect(result.success).toBe(true);
      expect(result.conversations![0].unreadCount).toBe(5);
    });

    it("should return error when user lacks permission", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(false);

      const result = await getConversations();

      expect(result.error).toBe("You don't have permission to view messages");
      expect(result.conversations).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockRejectedValue(new Error("Database error"));

      const result = await getConversations();

      expect(result.error).toBe("Failed to fetch conversations");
      expect(result.conversations).toBeUndefined();
    });
  });

  // ==========================================================================
  // getConversationById() - Get a single conversation
  // ==========================================================================
  describe("getConversationById()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should return conversation when user is participant and shares venue", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const mockConversation = {
        id: "cltestconv1aaaaaaa",
        type: "ONE_ON_ONE",
        name: null,
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await getConversationById("cltestconv1aaaaaaa");

      expect(result.success).toBe(true);
      expect(result.conversation).toBeDefined();
      expect(result.conversation!.id).toBe("cltestconv1aaaaaaa");
    });

    it("should return error when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const mockConversation = {
        id: "cltestconv1aaaaaaa",
        type: "ONE_ON_ONE",
        name: null,
        participants: [
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user3.id,
            user: {
              id: testUsers.user3.id,
              email: testUsers.user3.email,
              firstName: testUsers.user3.firstName,
              lastName: testUsers.user3.lastName,
              profileImage: testUsers.user3.profileImage,
              role: { name: "MANAGER" },
            },
          },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await getConversationById("cltestconv1aaaaaaa");

      expect(result.error).toBe("You don't have access to this conversation");
      expect(result.conversation).toBeUndefined();
    });

    it("should return error when participants don't share venue", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user3.id]); // user2 not in shared venues

      const mockConversation = {
        id: "cltestconv1aaaaaaa",
        type: "ONE_ON_ONE",
        name: null,
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await getConversationById("cltestconv1aaaaaaa");

      expect(result.error).toBe("You don't have access to this conversation");
      expect(result.conversation).toBeUndefined();
    });

    it("should include all participants with venue info", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user3.id,
            user: {
              id: testUsers.user3.id,
              email: testUsers.user3.email,
              firstName: testUsers.user3.firstName,
              lastName: testUsers.user3.lastName,
              profileImage: testUsers.user3.profileImage,
              role: { name: "MANAGER" },
            },
          },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await getConversationById("cltestconvgroupaaa");

      expect(result.success).toBe(true);
      expect(result.conversation!.participants).toHaveLength(3);
      expect(result.conversation!.participants[0].user.role.name).toBeDefined();
    });

    it("should return error when conversation not found", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await getConversationById("non-existent");

      expect(result.error).toBe("Conversation not found");
      expect(result.conversation).toBeUndefined();
    });

    it("should return error when user lacks permission", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(false);

      const result = await getConversationById("cltestconv1aaaaaaa");

      expect(result.error).toBe("You don't have permission to view messages");
      expect(result.conversation).toBeUndefined();
    });
  });

  // ==========================================================================
  // findOrCreateConversation() - Find or create 1-on-1 conversation
  // ==========================================================================
  describe("findOrCreateConversation()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should find existing conversation between shared venue users", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const existingConversation = {
        id: "cltestconvexistsaa",
        type: "ONE_ON_ONE",
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
      };

      mockPrisma.conversation.findFirst.mockResolvedValue(existingConversation);

      const result = await findOrCreateConversation(testUsers.user2.id);

      expect(result.success).toBe(true);
      expect(result.conversation!.id).toBe("cltestconvexistsaa");
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it("should create new conversation between shared venue users", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const newConversation = {
        id: "cltestconvnewaaaaa",
        type: "ONE_ON_ONE",
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
      };

      mockPrisma.conversation.create.mockResolvedValue(newConversation);

      const result = await findOrCreateConversation(testUsers.user2.id);

      expect(result.success).toBe(true);
      expect(result.conversation!.id).toBe("cltestconvnewaaaaa");
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "ONE_ON_ONE",
          }),
        })
      );
    });

    it("should return error when users don't share venue", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]); // user4 not in list

      const result = await findOrCreateConversation(testUsers.user4.id);

      expect(result.error).toBe(
        "You can only create conversations with users in your venues"
      );
      expect(result.conversation).toBeUndefined();
    });

    it("should return error when user lacks permission", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(false);

      const result = await findOrCreateConversation(testUsers.user2.id);

      expect(result.error).toBe("You don't have permission to create conversations");
      expect(result.conversation).toBeUndefined();
    });
  });

  // ==========================================================================
  // createGroupConversation() - Create group conversation
  // ==========================================================================
  describe("createGroupConversation()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should create group conversation with shared venue users", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const newGroupConversation = {
        id: "cltestconvgroupnew",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user3.id,
            user: {
              id: testUsers.user3.id,
              email: testUsers.user3.email,
              firstName: testUsers.user3.firstName,
              lastName: testUsers.user3.lastName,
              profileImage: testUsers.user3.profileImage,
              role: { name: "MANAGER" },
            },
          },
        ],
      };

      mockPrisma.conversation.create.mockResolvedValue(newGroupConversation);
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await createGroupConversation({
        participantIds: [testUsers.user2.id, testUsers.user3.id],
        type: "GROUP",
        name: "Team Chat",
      });

      expect(result.success).toBe(true);
      expect(result.conversation!.name).toBe("Team Chat");
      expect(result.conversation!.type).toBe("GROUP");
      expect(result.conversation!.participants).toHaveLength(3);
    });

    it("should return error if any participant not in shared venue", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]); // user4 not in shared venues

      const result = await createGroupConversation({
        participantIds: [testUsers.user2.id, testUsers.user4.id],
        type: "GROUP",
        name: "Team Chat",
      });

      expect(result.error).toBe(
        "You can only add users from your venues to the conversation"
      );
      expect(result.conversation).toBeUndefined();
    });

    it("should set title correctly", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const newGroupConversation = {
        id: "cltestconvgroupnew",
        type: "GROUP",
        name: "Project Discussion",
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: testUsers.user2.email,
              firstName: testUsers.user2.firstName,
              lastName: testUsers.user2.lastName,
              profileImage: testUsers.user2.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
      };

      mockPrisma.conversation.create.mockResolvedValue(newGroupConversation);
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await createGroupConversation({
        participantIds: [testUsers.user2.id],
        type: "GROUP",
        name: "Project Discussion",
      });

      expect(result.success).toBe(true);
      expect(result.conversation!.name).toBe("Project Discussion");
    });

    it("should mark as group conversation", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const newGroupConversation = {
        id: "cltestconvgroupnew",
        type: "GROUP",
        name: "Test Group",
        participants: [
          {
            userId: mockUser.id,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              profileImage: mockUser.profileImage,
              role: { name: "STAFF" },
            },
          },
        ],
      };

      mockPrisma.conversation.create.mockResolvedValue(newGroupConversation);
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await createGroupConversation({
        participantIds: [testUsers.user2.id],
        type: "GROUP",
        name: "Test Group",
      });

      expect(result.success).toBe(true);
      expect(result.conversation!.type).toBe("GROUP");
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "GROUP",
          }),
        })
      );
    });

    it("should return error for invalid schema", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await createGroupConversation({
        participantIds: [],
        type: "GROUP",
        name: "Test",
      });

      expect(result.error).toBeDefined();
      expect(result.conversation).toBeUndefined();
    });

    it("should return error when name is missing for group conversation", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await createGroupConversation({
        participantIds: [testUsers.user2.id],
        type: "GROUP",
        name: null,
      });

      expect(result.error).toBe("Group conversations must have a name");
      expect(result.conversation).toBeUndefined();
    });

    it("should return error when user lacks permission", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(false);

      const result = await createGroupConversation({
        participantIds: [testUsers.user2.id],
        type: "GROUP",
        name: "Test",
      });

      expect(result.error).toBe("You don't have permission to create conversations");
      expect(result.conversation).toBeUndefined();
    });
  });

  // ==========================================================================
  // addParticipants() - Add participants to group conversation
  // ==========================================================================
  describe("addParticipants()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should add participants who share venues with existing participants", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          { userId: mockUser.id },
          { userId: testUsers.user2.id },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.conversationParticipant.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await addParticipants({
        conversationId: "cltestconvgroupaaa",
        userIds: [testUsers.user3.id],
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.conversationParticipant.createMany).toHaveBeenCalledWith({
        data: [
          {
            conversationId: "cltestconvgroupaaa",
            userId: testUsers.user3.id,
          },
        ],
      });
    });

    it("should return error for participants not in shared venues", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]); // user4 not in shared venues

      const result = await addParticipants({
        conversationId: "cltestconvgroupaaa",
        userIds: [testUsers.user4.id],
      });

      expect(result.error).toBe(
        "You can only add users from your venues to the conversation"
      );
    });

    it("should validate user is conversation member", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user3.id]);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          { userId: testUsers.user2.id }, // Current user not in participants
          { userId: testUsers.user3.id },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await addParticipants({
        conversationId: "cltestconvgroupaaa",
        userIds: [testUsers.user3.id],
      });

      expect(result.error).toBe("You don't have access to this conversation");
    });

    it("should only work for group conversations", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id, testUsers.user3.id]);

      const mockConversation = {
        id: "cltestconv1on1aaaa",
        type: "ONE_ON_ONE",
        name: null,
        participants: [{ userId: mockUser.id }, { userId: testUsers.user2.id }],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await addParticipants({
        conversationId: "cltestconv1on1aaaa",
        userIds: [testUsers.user3.id],
      });

      expect(result.error).toBe("Can only add participants to group conversations");
    });

    it("should return error when conversation not found", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await addParticipants({
        conversationId: "cltestnonexistentaa",
        userIds: [testUsers.user2.id],
      });

      expect(result.error).toBe("Conversation not found");
    });

    it("should return error when all users are already participants", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user2.id]);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          { userId: mockUser.id },
          { userId: testUsers.user2.id },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await addParticipants({
        conversationId: "cltestconvgroupaaa",
        userIds: [testUsers.user2.id], // Already a participant
      });

      expect(result.error).toBe("All users are already participants");
    });
  });

  // ==========================================================================
  // leaveConversation() - Leave a conversation
  // ==========================================================================
  describe("leaveConversation()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should allow user to leave conversation", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          { userId: mockUser.id },
          { userId: testUsers.user2.id },
          { userId: testUsers.user3.id },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.conversationParticipant.deleteMany.mockResolvedValue({ count: 1 });

      const result = await leaveConversation("cltestconvgroupaaa");

      expect(result.success).toBe(true);
      expect(mockPrisma.conversationParticipant.deleteMany).toHaveBeenCalledWith({
        where: {
          conversationId: "cltestconvgroupaaa",
          userId: mockUser.id,
        },
      });
    });

    it("should validate user is participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          { userId: testUsers.user2.id },
          { userId: testUsers.user3.id },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await leaveConversation("cltestconvgroupaaa");

      expect(result.error).toBe("You are not a participant in this conversation");
    });

    it("should maintain conversation for other participants", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [
          { userId: mockUser.id },
          { userId: testUsers.user2.id },
          { userId: testUsers.user3.id },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.conversationParticipant.deleteMany.mockResolvedValue({ count: 1 });

      const result = await leaveConversation("cltestconvgroupaaa");

      expect(result.success).toBe(true);
      // Only delete current user's participation, not the conversation
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });

    it("should return error when conversation not found", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await leaveConversation("non-existent");

      expect(result.error).toBe("Conversation not found");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const mockConversation = {
        id: "cltestconvgroupaaa",
        type: "GROUP",
        name: "Team Chat",
        participants: [{ userId: mockUser.id }],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.conversationParticipant.deleteMany.mockRejectedValue(
        new Error("Database error")
      );

      const result = await leaveConversation("cltestconvgroupaaa");

      expect(result.error).toBe("Failed to leave conversation");
    });
  });
});
