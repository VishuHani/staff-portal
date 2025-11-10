/**
 * Comprehensive Unit Tests for Message Actions
 *
 * Tests all venue-filtered message functions with focus on:
 * - Venue-based data isolation through conversation participants
 * - Permission checking (RBAC)
 * - Message CRUD operations
 * - Cross-venue isolation
 * - Read tracking and unread counts
 * - Message reactions
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testRoles } from "../../helpers/fixtures";

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
  message: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  conversationParticipant: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  conversation: {
    findUnique: vi.fn(),
    update: vi.fn(),
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
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  markMessageAsRead,
  markConversationAsRead,
  getUnreadMessageCount,
  searchMessages,
  toggleReaction,
} from "@/lib/actions/messages";

describe("Message Actions - Venue Filtering", () => {
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
  // getMessages() - Get messages for a conversation
  // ==========================================================================
  describe("getMessages()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const conversationId = "cltestconvmsg1aaaa";

    it("should return messages when user is participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
        lastReadAt: new Date(),
      });

      const mockMessages = [
        {
          id: "msg-1",
          conversationId,
          senderId: testUsers.user2.id,
          content: "Hello!",
          createdAt: new Date(Date.now() - 1000),
          sender: {
            id: testUsers.user2.id,
            email: "user2@example.com",
            firstName: "User",
            lastName: "Two",
            profileImage: null,
            role: { name: "STAFF" },
          },
          readBy: [],
        },
        {
          id: "msg-2",
          conversationId,
          senderId: mockUser.id,
          content: "Hi there!",
          createdAt: new Date(),
          sender: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            profileImage: mockUser.profileImage,
            role: { name: "STAFF" },
          },
          readBy: [],
        },
      ];

      mockPrisma.message.findMany.mockResolvedValue(mockMessages);

      const result = await getMessages(conversationId);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(mockPrisma.conversationParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          conversationId,
          userId: mockUser.id,
        },
      });
    });

    it("should return error when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      const result = await getMessages(conversationId);

      expect(result.error).toBe("You don't have access to this conversation");
      expect(result.messages).toBeUndefined();
    });

    it("should apply pagination with cursor", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });
      mockPrisma.message.findMany.mockResolvedValue([]);

      const cursor = new Date().toISOString();
      await getMessages(conversationId, 25, cursor);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId,
            createdAt: {
              lt: new Date(cursor),
            },
          }),
          take: 25,
        })
      );
    });

    it("should use default limit of 50", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });
      mockPrisma.message.findMany.mockResolvedValue([]);

      await getMessages(conversationId);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it("should order by createdAt desc and reverse results", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const mockMessages = [
        { id: "msg-3", createdAt: new Date(3000), content: "Third", sender: {} },
        { id: "msg-2", createdAt: new Date(2000), content: "Second", sender: {} },
        { id: "msg-1", createdAt: new Date(1000), content: "First", sender: {} },
      ];

      mockPrisma.message.findMany.mockResolvedValue(mockMessages);

      const result = await getMessages(conversationId);

      // Should reverse to show oldest first
      expect(result.messages![0].id).toBe("msg-1");
      expect(result.messages![2].id).toBe("msg-3");
    });

    it("should indicate hasMore when limit is reached", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const mockMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId,
        senderId: mockUser.id,
        content: `Message ${i}`,
        createdAt: new Date(),
        sender: {},
      }));

      mockPrisma.message.findMany.mockResolvedValue(mockMessages);

      const result = await getMessages(conversationId, 50);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it("should include sender details with role", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const mockMessages = [
        {
          id: "msg-1",
          conversationId,
          senderId: testUsers.user2.id,
          content: "Test message",
          createdAt: new Date(),
          sender: {
            id: testUsers.user2.id,
            email: "user2@example.com",
            firstName: "User",
            lastName: "Two",
            profileImage: "avatar.jpg",
            role: { name: "MANAGER" },
          },
        },
      ];

      mockPrisma.message.findMany.mockResolvedValue(mockMessages);

      const result = await getMessages(conversationId);

      expect(result.messages![0].sender.role.name).toBe("MANAGER");
      expect(result.messages![0].sender.profileImage).toBe("avatar.jpg");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const result = await getMessages(conversationId);

      expect(result.error).toBe("Failed to fetch messages");
    });
  });

  // ==========================================================================
  // sendMessage() - Send a new message
  // ==========================================================================
  describe("sendMessage()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const conversationId = "cltestconvsend1aaa";

    it("should send message successfully when user is participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const mockConversation = {
        id: conversationId,
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
            },
          },
          {
            userId: testUsers.user2.id,
            user: {
              id: testUsers.user2.id,
              email: "user2@example.com",
              firstName: "User",
              lastName: "Two",
              profileImage: null,
            },
            mutedUntil: null,
          },
        ],
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const newMessage = {
        id: "new-msg-1",
        conversationId,
        senderId: mockUser.id,
        content: "Test message",
        mediaUrls: null,
        createdAt: new Date(),
        sender: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          profileImage: mockUser.profileImage,
          role: { name: "STAFF" },
        },
      };

      mockPrisma.message.create.mockResolvedValue(newMessage);
      mockPrisma.conversation.update.mockResolvedValue(mockConversation);
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await sendMessage({
        conversationId,
        content: "Test message",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.content).toBe("Test message");
    });

    it("should prevent sending message when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      const result = await sendMessage({
        conversationId,
        content: "Test message",
      });

      expect(result.error).toBe("You don't have access to this conversation");
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });

    it("should validate content is not empty", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      const result = await sendMessage({
        conversationId,
        content: "",
      });

      expect(result.error).toContain("Message cannot be empty");
    });

    it("should validate content length", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      const longContent = "a".repeat(2001); // Exceeds MAX_MESSAGE_LENGTH (2000)

      const result = await sendMessage({
        conversationId,
        content: longContent,
      });

      expect(result.error).toContain("must not exceed 2000 characters");
    });

    it("should handle media URLs correctly", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        type: "GROUP",
        name: "Test Group",
        participants: [{ userId: mockUser.id, user: {} }],
      });

      const mediaUrls = ["https://example.com/image1.jpg"];

      mockPrisma.message.create.mockResolvedValue({
        id: "new-msg-1",
        conversationId,
        senderId: mockUser.id,
        content: "Check this out",
        mediaUrls: JSON.stringify(mediaUrls),
        sender: {
          id: mockUser.id,
          email: mockUser.email,
          role: { name: "STAFF" },
        },
      });

      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await sendMessage({
        conversationId,
        content: "Check this out",
        mediaUrls,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mediaUrls: JSON.stringify(mediaUrls),
          }),
        })
      );
    });

    it("should update conversation last message info", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        type: "ONE_ON_ONE",
        participants: [{ userId: mockUser.id, user: {} }],
      });

      mockPrisma.message.create.mockResolvedValue({
        id: "new-msg-1",
        conversationId,
        senderId: mockUser.id,
        content: "Test message",
        sender: { id: mockUser.id, email: mockUser.email, role: { name: "STAFF" } },
      });

      mockPrisma.conversation.update.mockResolvedValue({});

      await sendMessage({
        conversationId,
        content: "Test message",
      });

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: expect.objectContaining({
          lastMessageAt: expect.any(Date),
          lastMessage: "Test message",
        }),
      });
    });

    it("should create notifications for other participants", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        type: "ONE_ON_ONE",
        name: null,
        participants: [
          { userId: mockUser.id, user: {} },
          { userId: testUsers.user2.id, user: {}, mutedUntil: null },
        ],
      });

      mockPrisma.message.create.mockResolvedValue({
        id: "new-msg-1",
        conversationId,
        senderId: mockUser.id,
        content: "Test notification",
        sender: { id: mockUser.id, email: mockUser.email, role: { name: "STAFF" } },
      });

      mockPrisma.conversation.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      await sendMessage({
        conversationId,
        content: "Test notification",
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUsers.user2.id,
          type: "NEW_MESSAGE",
          title: "New message",
        }),
      });
    });

    it("should not create notifications for muted conversations", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        type: "ONE_ON_ONE",
        participants: [
          { userId: mockUser.id, user: {} },
          { userId: testUsers.user2.id, user: {}, mutedUntil: futureDate },
        ],
      });

      mockPrisma.message.create.mockResolvedValue({
        id: "new-msg-1",
        conversationId,
        senderId: mockUser.id,
        content: "Muted message",
        sender: { id: mockUser.id, email: mockUser.email, role: { name: "STAFF" } },
      });

      mockPrisma.conversation.update.mockResolvedValue({});

      await sendMessage({
        conversationId,
        content: "Muted message",
      });

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it("should return error when user lacks permission", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(false);

      const result = await sendMessage({
        conversationId,
        content: "Test message",
      });

      expect(result.error).toBe("You don't have permission to send messages");
    });

    it("should return error when conversation not found", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await sendMessage({
        conversationId,
        content: "Test message",
      });

      expect(result.error).toBe("Conversation not found");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.conversationParticipant.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const result = await sendMessage({
        conversationId,
        content: "Test message",
      });

      expect(result.error).toBe("Failed to send message");
    });
  });

  // ==========================================================================
  // updateMessage() - Update own message
  // ==========================================================================
  describe("updateMessage()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const messageId = "cltestmsgupdate1aa";

    it("should update own message successfully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: mockUser.id,
        content: "Original content",
        createdAt: fiveMinutesAgo,
      });

      const updatedMessage = {
        id: messageId,
        senderId: mockUser.id,
        content: "Updated content",
        updatedAt: new Date(),
        sender: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          profileImage: mockUser.profileImage,
          role: { name: "STAFF" },
        },
      };

      mockPrisma.message.update.mockResolvedValue(updatedMessage);

      const result = await updateMessage({
        id: messageId,
        content: "Updated content",
      });

      expect(result.success).toBe(true);
      expect(result.message!.content).toBe("Updated content");
    });

    it("should not allow updating other user's message", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: testUsers.user2.id, // Different user
        content: "Original content",
        createdAt: new Date(),
      });

      const result = await updateMessage({
        id: messageId,
        content: "Updated content",
      });

      expect(result.error).toBe("You can only edit your own messages");
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it("should not allow editing messages older than 15 minutes", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: mockUser.id,
        content: "Original content",
        createdAt: twentyMinutesAgo,
      });

      const result = await updateMessage({
        id: messageId,
        content: "Updated content",
      });

      expect(result.error).toBe("Messages can only be edited within 15 minutes");
    });

    it("should validate content is not empty", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await updateMessage({
        id: messageId,
        content: "",
      });

      expect(result.error).toContain("Message cannot be empty");
    });

    it("should validate content length", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const longContent = "a".repeat(2001);

      const result = await updateMessage({
        id: messageId,
        content: longContent,
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("2000");
    });

    it("should return error for non-existent message", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await updateMessage({
        id: "cltestnonexistaaaa", // Valid CUID format
        content: "Updated content",
      });

      expect(result.error).toBe("Message not found");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockRejectedValue(new Error("Database error"));

      const result = await updateMessage({
        id: messageId,
        content: "Updated content",
      });

      expect(result.error).toBe("Failed to update message");
    });
  });

  // ==========================================================================
  // deleteMessage() - Delete own message
  // ==========================================================================
  describe("deleteMessage()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const messageId = "cltestmsgdelete1aa";

    it("should delete own message successfully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: mockUser.id,
        content: "Message to delete",
      });

      mockPrisma.message.delete.mockResolvedValue({
        id: messageId,
      });

      const result = await deleteMessage({ id: messageId });

      expect(result.success).toBe(true);
      expect(mockPrisma.message.delete).toHaveBeenCalledWith({
        where: { id: messageId },
      });
    });

    it("should not allow deleting other user's message", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: testUsers.user2.id, // Different user
        content: "Message to delete",
      });

      const result = await deleteMessage({ id: messageId });

      expect(result.error).toBe("You can only delete your own messages");
      expect(mockPrisma.message.delete).not.toHaveBeenCalled();
    });

    it("should return error for non-existent message", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await deleteMessage({ id: "cltestnonexistaaaa" }); // Valid CUID format

      expect(result.error).toBe("Message not found");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: mockUser.id,
      });

      mockPrisma.message.delete.mockRejectedValue(new Error("Database error"));

      const result = await deleteMessage({ id: messageId });

      expect(result.error).toBe("Failed to delete message");
    });
  });

  // ==========================================================================
  // markMessageAsRead() - Mark single message as read
  // ==========================================================================
  describe("markMessageAsRead()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const messageId = "cltestmsgread1aaaa";
    const conversationId = "cltestconvread1aaa";

    it("should mark message as read when user is participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        conversationId,
        senderId: testUsers.user2.id,
        readBy: [],
      });

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      mockPrisma.message.update.mockResolvedValue({
        id: messageId,
        readBy: [mockUser.id],
      });

      const result = await markMessageAsRead(messageId);

      expect(result.success).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          readBy: {
            push: mockUser.id,
          },
          readAt: expect.any(Date),
        },
      });
    });

    it("should not mark own messages as read", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        conversationId,
        senderId: mockUser.id, // Own message
        readBy: [],
      });

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const result = await markMessageAsRead(messageId);

      expect(result.success).toBe(true);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it("should not mark message as read if already read", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        conversationId,
        senderId: testUsers.user2.id,
        readBy: [mockUser.id], // Already read
      });

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      const result = await markMessageAsRead(messageId);

      expect(result.success).toBe(true);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it("should return error when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        conversationId,
        senderId: testUsers.user2.id,
        readBy: [],
      });

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      const result = await markMessageAsRead(messageId);

      expect(result.error).toBe("You don't have access to this conversation");
    });

    it("should return error for non-existent message", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await markMessageAsRead("non-existent-msg");

      expect(result.error).toBe("Message not found");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockRejectedValue(new Error("Database error"));

      const result = await markMessageAsRead(messageId);

      expect(result.error).toBe("Failed to mark message as read");
    });
  });

  // ==========================================================================
  // markConversationAsRead() - Mark all messages in conversation as read
  // ==========================================================================
  describe("markConversationAsRead()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const conversationId = "cltestconvread2aaa";

    it("should mark all messages as read for participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
        lastReadAt: new Date(Date.now() - 86400000), // 1 day ago
      });

      const unreadMessages = [
        { id: "msg-1" },
        { id: "msg-2" },
        { id: "msg-3" },
      ];

      mockPrisma.message.findMany.mockResolvedValue(unreadMessages);
      mockPrisma.conversationParticipant.update.mockResolvedValue({});
      mockPrisma.message.update.mockResolvedValue({});

      const result = await markConversationAsRead({ conversationId });

      expect(result.success).toBe(true);
      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: { id: "participant-1" },
        data: {
          lastReadAt: expect.any(Date),
        },
      });
      expect(mockPrisma.message.update).toHaveBeenCalledTimes(3);
    });

    it("should return error when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      const result = await markConversationAsRead({ conversationId });

      expect(result.error).toBe("You don't have access to this conversation");
    });

    it("should only mark unread messages", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
      });

      mockPrisma.message.findMany.mockResolvedValue([
        { id: "msg-1" }, // Only one unread message
      ]);

      mockPrisma.conversationParticipant.update.mockResolvedValue({});
      mockPrisma.message.update.mockResolvedValue({});

      const result = await markConversationAsRead({ conversationId });

      expect(result.success).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledTimes(1);
    });

    it("should handle validation errors", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await markConversationAsRead({ conversationId: "invalid-id" });

      expect(result.error).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const result = await markConversationAsRead({ conversationId });

      expect(result.error).toBe("Failed to mark conversation as read");
    });
  });

  // ==========================================================================
  // getUnreadMessageCount() - Get unread message count
  // ==========================================================================
  describe("getUnreadMessageCount()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const conversationId = "cltestconvcount1aa";

    it("should return unread count for specific conversation", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const lastReadAt = new Date(Date.now() - 3600000); // 1 hour ago

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
        lastReadAt,
      });

      mockPrisma.message.count.mockResolvedValue(5);

      const result = await getUnreadMessageCount(conversationId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: {
          conversationId,
          senderId: { not: mockUser.id },
          createdAt: {
            gt: lastReadAt,
          },
        },
      });
    });

    it("should return total unread count across all conversations", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const participants = [
        {
          conversationId: "conv-1",
          lastReadAt: new Date(Date.now() - 3600000),
        },
        {
          conversationId: "conv-2",
          lastReadAt: new Date(Date.now() - 7200000),
        },
      ];

      mockPrisma.conversationParticipant.findMany.mockResolvedValue(participants);
      mockPrisma.message.count
        .mockResolvedValueOnce(3) // conv-1
        .mockResolvedValueOnce(2); // conv-2

      const result = await getUnreadMessageCount();

      expect(result.success).toBe(true);
      expect(result.count).toBe(5); // 3 + 2
    });

    it("should return error when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      const result = await getUnreadMessageCount(conversationId);

      expect(result.error).toBe("You don't have access to this conversation");
    });

    it("should use epoch date when lastReadAt is null", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        conversationId,
        userId: mockUser.id,
        lastReadAt: null,
      });

      mockPrisma.message.count.mockResolvedValue(10);

      const result = await getUnreadMessageCount(conversationId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(10);
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.conversationParticipant.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const result = await getUnreadMessageCount(conversationId);

      expect(result.error).toBe("Failed to get unread count");
    });
  });

  // ==========================================================================
  // searchMessages() - Search messages with venue filtering
  // ==========================================================================
  describe("searchMessages()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };

    it("should search messages only from shared venue users", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const participants = [
        { conversationId: "conv-1" },
        { conversationId: "conv-2" },
      ];

      mockPrisma.conversationParticipant.findMany.mockResolvedValue(participants);

      const mockMessages = [
        {
          id: "msg-1",
          content: "Hello world",
          senderId: testUsers.user2.id,
          sender: {
            id: testUsers.user2.id,
            email: "user2@example.com",
            firstName: "User",
            lastName: "Two",
            profileImage: null,
          },
          conversation: {
            id: "conv-1",
            type: "ONE_ON_ONE",
            name: null,
          },
        },
      ];

      mockPrisma.message.findMany.mockResolvedValue(mockMessages);

      const result = await searchMessages("hello");

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: {
              in: ["conv-1", "conv-2"],
            },
            senderId: {
              in: [testUsers.user1.id, testUsers.user2.id, testUsers.user3.id],
            },
            content: {
              contains: "hello",
              mode: "insensitive",
            },
          }),
        })
      );
    });

    it("should exclude messages from users in other venues", async () => {
      mockGetCurrentUser.mockResolvedValue(testUsers.user2);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]); // user3 not in shared venues

      mockPrisma.conversationParticipant.findMany.mockResolvedValue([
        { conversationId: "conv-1" },
      ]);

      mockPrisma.message.findMany.mockResolvedValue([]);

      await searchMessages("test");

      const call = mockPrisma.message.findMany.mock.calls[0][0];
      expect(call.where.senderId.in).not.toContain(testUsers.user3.id);
    });

    it("should validate minimum query length", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await searchMessages("a"); // Too short

      expect(result.error).toBe("Search query must be at least 2 characters");
    });

    it("should validate query is not empty", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await searchMessages("");

      expect(result.error).toBe("Search query must be at least 2 characters");
    });

    it("should respect limit parameter", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([mockUser.id]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await searchMessages("test", 25);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
        })
      );
    });

    it("should use default limit of 50", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([mockUser.id]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await searchMessages("test");

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it("should include sender and conversation details", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockResolvedValue([mockUser.id]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await searchMessages("test");

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            sender: expect.any(Object),
            conversation: expect.any(Object),
          }),
        })
      );
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSharedVenueUsers.mockRejectedValue(new Error("Database error"));

      const result = await searchMessages("test");

      expect(result.error).toBe("Failed to search messages");
    });
  });

  // ==========================================================================
  // toggleReaction() - Toggle reaction on message
  // ==========================================================================
  describe("toggleReaction()", () => {
    const mockUser = {
      ...testUsers.user1,
      active: true,
      role: testRoles.staff,
    };
    const messageId = "cltestmsgreact1aaa";

    it("should add reaction when user is participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        reactions: null,
        conversation: {
          participants: [{ userId: mockUser.id }],
        },
      });

      mockPrisma.message.update.mockResolvedValue({
        id: messageId,
        reactions: JSON.stringify([{ emoji: "👍", userId: mockUser.id }]),
      });

      const result = await toggleReaction({
        messageId,
        emoji: "👍",
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          reactions: JSON.stringify([{ emoji: "👍", userId: mockUser.id }]),
        },
      });
    });

    it("should remove reaction if already exists", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const existingReactions = [
        { emoji: "👍", userId: mockUser.id },
        { emoji: "❤️", userId: testUsers.user2.id },
      ];

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        reactions: JSON.stringify(existingReactions),
        conversation: {
          participants: [{ userId: mockUser.id }],
        },
      });

      mockPrisma.message.update.mockResolvedValue({
        id: messageId,
        reactions: JSON.stringify([{ emoji: "❤️", userId: testUsers.user2.id }]),
      });

      const result = await toggleReaction({
        messageId,
        emoji: "👍",
      });

      expect(result.success).toBe(true);
      // Should remove user1's reaction, keep user2's
      const updatedReactions = JSON.parse(
        mockPrisma.message.update.mock.calls[0][0].data.reactions
      );
      expect(updatedReactions).toHaveLength(1);
      expect(updatedReactions[0].userId).toBe(testUsers.user2.id);
    });

    it("should add new reaction alongside existing ones", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const existingReactions = [
        { emoji: "👍", userId: testUsers.user2.id },
      ];

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        reactions: JSON.stringify(existingReactions),
        conversation: {
          participants: [{ userId: mockUser.id }],
        },
      });

      mockPrisma.message.update.mockResolvedValue({
        id: messageId,
        reactions: JSON.stringify([
          ...existingReactions,
          { emoji: "❤️", userId: mockUser.id },
        ]),
      });

      const result = await toggleReaction({
        messageId,
        emoji: "❤️",
      });

      expect(result.success).toBe(true);
    });

    it("should set reactions to null when removing last reaction", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const existingReactions = [{ emoji: "👍", userId: mockUser.id }];

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        reactions: JSON.stringify(existingReactions),
        conversation: {
          participants: [{ userId: mockUser.id }],
        },
      });

      mockPrisma.message.update.mockResolvedValue({
        id: messageId,
        reactions: null,
      });

      const result = await toggleReaction({
        messageId,
        emoji: "👍",
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          reactions: null,
        },
      });
    });

    it("should return error when user is not participant", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      mockPrisma.message.findUnique.mockResolvedValue({
        id: messageId,
        reactions: null,
        conversation: {
          participants: [], // User not in participants
        },
      });

      const result = await toggleReaction({
        messageId,
        emoji: "👍",
      });

      expect(result.error).toBe("You don't have access to this conversation");
    });

    it("should return error for non-existent message", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await toggleReaction({
        messageId: "cltestnonexistaaaa", // Valid CUID format
        emoji: "👍",
      });

      expect(result.error).toBe("Message not found");
    });

    it("should validate emoji is provided", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const result = await toggleReaction({
        messageId,
        emoji: "",
      });

      expect(result.error).toContain("Emoji is required");
    });

    it("should handle database errors gracefully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockPrisma.message.findUnique.mockRejectedValue(new Error("Database error"));

      const result = await toggleReaction({
        messageId,
        emoji: "👍",
      });

      expect(result.error).toBe("Failed to toggle reaction");
    });
  });
});
