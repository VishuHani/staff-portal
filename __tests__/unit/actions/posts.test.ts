/**
 * Comprehensive Unit Tests for Posts Actions
 *
 * Tests all posts functions with focus on:
 * - Venue-based data isolation
 * - Permission checking (RBAC)
 * - Input validation
 * - Multi-venue support
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  testUsers,
  testVenues,
  testUserVenues,
  testRoles,
  createPostFixture,
  createCommentFixture,
} from "../../helpers/fixtures";

// Mock dependencies - must be before imports
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      count: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
    },
    postRead: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: vi.fn(),
  canAccess: vi.fn(),
}));

vi.mock("@/lib/utils/venue", () => ({
  getSharedVenueUsers: vi.fn(),
}));

import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  pinPost,
  getPostStats,
} from "@/lib/actions/posts";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { revalidatePath } from "next/cache";

describe("Posts Actions", () => {
  let mockPrisma: any;
  let mockRequireAuth: any;
  let mockCanAccess: any;
  let mockGetSharedVenueUsers: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = prisma;
    mockRequireAuth = requireAuth as any;
    mockCanAccess = canAccess as any;
    mockGetSharedVenueUsers = getSharedVenueUsers as any;
  });

  // ==========================================================================
  // getPosts() - Get posts with venue filtering
  // ==========================================================================
  describe("getPosts()", () => {
    const channelId = "cln1234567890abcdefgh";

    it("should return only posts from shared venue users", async () => {
      // User 1 in Venue A and B
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      // Shared venue users: user1, user2, user3
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      const mockPosts = [
        createPostFixture({
          id: "post-1",
          authorId: testUsers.user1.id,
          channelId,
        }),
        createPostFixture({
          id: "post-2",
          authorId: testUsers.user3.id,
          channelId,
        }),
      ];

      mockPrisma.post.findMany.mockResolvedValue(
        mockPosts.map((post) => ({
          ...post,
          author: {
            id: post.authorId,
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            profileImage: null,
            role: { name: "STAFF" },
          },
          channel: {
            id: channelId,
            name: "General",
            color: "#3B82F6",
            icon: "💬",
          },
          _count: { comments: 0, reactions: 0 },
          reactions: [],
        }))
      );

      const result = await getPosts();

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(2);

      // Verify venue filtering in query
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: {
              in: [testUsers.user1.id, testUsers.user2.id, testUsers.user3.id],
            },
          }),
        })
      );
    });

    it("should filter by channel when specified", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      await getPosts({ channelId });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            channelId,
          }),
        })
      );
    });

    it("should filter by pinned status when specified", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      await getPosts({ pinned: true });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pinned: true,
          }),
        })
      );
    });

    it("should exclude posts from users in other venues", async () => {
      // User 2 only in Venue B
      mockRequireAuth.mockResolvedValue(testUsers.user2);

      // Only user1 and user2 share Venue B
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]);

      mockPrisma.post.findMany.mockResolvedValue([]);

      await getPosts();

      // Should NOT include user3 (only in Venue A)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: {
              in: [testUsers.user1.id, testUsers.user2.id],
            },
          }),
        })
      );

      const call = mockPrisma.post.findMany.mock.calls[0][0];
      expect(call.where.authorId.in).not.toContain(testUsers.user3.id);
    });

    it("should return empty array for user with no venues", async () => {
      // User 5 has no venues
      mockRequireAuth.mockResolvedValue(testUsers.user5);
      mockGetSharedVenueUsers.mockResolvedValue([]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      const result = await getPosts();

      expect(result.success).toBe(true);
      expect(result.posts).toEqual([]);

      // Query should include empty array (matches nothing)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: { in: [] },
          }),
        })
      );
    });

    it("should handle multi-venue user seeing posts from all their venues", async () => {
      // User 1 has Venue A and B
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      // Users from both venues
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id, // Venue B
        testUsers.user3.id, // Venue A
      ]);

      const mockPosts = [
        createPostFixture({
          id: "post-1",
          authorId: testUsers.user2.id, // Venue B
        }),
        createPostFixture({
          id: "post-2",
          authorId: testUsers.user3.id, // Venue A
        }),
      ];

      mockPrisma.post.findMany.mockResolvedValue(
        mockPosts.map((post) => ({
          ...post,
          author: {
            id: post.authorId,
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            profileImage: null,
            role: { name: "STAFF" },
          },
          channel: { id: channelId, name: "General", color: "#3B82F6", icon: "💬" },
          _count: { comments: 0, reactions: 0 },
          reactions: [],
        }))
      );

      const result = await getPosts();

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(2);
    });

    it("should apply pagination with cursor correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      const cursor = "cln9876543210zyxwvuts";
      await getPosts({ cursor, limit: 10 });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: cursor },
          skip: 1,
          take: 10,
        })
      );
    });

    it("should use default limit of 20 when not specified", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      await getPosts();

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });

    it("should order by pinned desc, then createdAt desc", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      await getPosts();

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        })
      );
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockRejectedValue(new Error("Database error"));

      const result = await getPosts();

      expect(result.error).toBe("Failed to fetch posts");
      expect(result.success).toBeUndefined();
    });

    it("should include comments and reactions counts", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findMany.mockResolvedValue([]);

      await getPosts();

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            _count: {
              select: {
                comments: true,
                reactions: true,
              },
            },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // getPostById() - Get single post with venue access check
  // ==========================================================================
  describe("getPostById()", () => {
    const postId = "clnpost1234567890abc";

    it("should return post when user has access (same venue)", async () => {
      // User 1 in Venue A
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      // User 1 and 3 share Venue A
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user3.id,
      ]);

      const mockPost = {
        ...createPostFixture({
          id: postId,
          authorId: testUsers.user3.id,
        }),
        author: {
          id: testUsers.user3.id,
          email: "user3@example.com",
          firstName: "User",
          lastName: "Three",
          profileImage: null,
          role: { name: "MANAGER" },
        },
        channel: {
          id: "channel-1",
          name: "General",
          color: "#3B82F6",
          icon: "💬",
        },
        comments: [],
        reactions: [],
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);

      const result = await getPostById(postId);

      expect(result.success).toBe(true);
      expect(result.post).toBeDefined();
      expect(result.post?.id).toBe(postId);
    });

    it("should return error when user doesn't have access (different venue)", async () => {
      // User 2 only in Venue B
      mockRequireAuth.mockResolvedValue(testUsers.user2);

      // User 2 only shares venue with user1
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]);

      const mockPost = createPostFixture({
        id: postId,
        authorId: testUsers.user3.id, // User 3 in Venue A only
      });

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);

      const result = await getPostById(postId);

      expect(result.error).toBe("Post not found");
      expect(result.success).toBeUndefined();
    });

    it("should return error for non-existent post", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findUnique.mockResolvedValue(null);

      const result = await getPostById("non-existent-id");

      expect(result.error).toBe("Post not found");
    });

    it("should include comments count", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);

      const mockPost = {
        ...createPostFixture({ id: postId, authorId: testUsers.user1.id }),
        author: {
          id: testUsers.user1.id,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          profileImage: null,
          role: { name: "STAFF" },
        },
        channel: {
          id: "channel-1",
          name: "General",
          color: "#3B82F6",
          icon: "💬",
        },
        comments: [
          createCommentFixture({ postId, userId: testUsers.user1.id }),
          createCommentFixture({ postId, userId: testUsers.user1.id }),
        ],
        reactions: [],
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);

      const result = await getPostById(postId);

      expect(result.success).toBe(true);
      expect(result.post?.comments).toHaveLength(2);
    });

    it("should include reactions count", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);

      const mockPost = {
        ...createPostFixture({ id: postId, authorId: testUsers.user1.id }),
        author: {
          id: testUsers.user1.id,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          profileImage: null,
          role: { name: "STAFF" },
        },
        channel: {
          id: "channel-1",
          name: "General",
          color: "#3B82F6",
          icon: "💬",
        },
        comments: [],
        reactions: [
          { userId: testUsers.user1.id, emoji: "👍", user: {} },
          { userId: testUsers.user2.id, emoji: "❤️", user: {} },
        ],
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);

      const result = await getPostById(postId);

      expect(result.success).toBe(true);
      expect(result.post?.reactions).toHaveLength(2);
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findUnique.mockRejectedValue(new Error("Database error"));

      const result = await getPostById(postId);

      expect(result.error).toBe("Failed to fetch post");
    });
  });

  // ==========================================================================
  // createPost() - Create new post with validation
  // ==========================================================================
  describe("createPost()", () => {
    const channelId = "clnchannel1234567890";
    const validContent = "This is a valid post content";

    it("should create post successfully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.channel.findUnique.mockResolvedValue({
        id: channelId,
        name: "General",
        archived: false,
      });

      const mockPost = {
        id: "new-post-id",
        channelId,
        authorId: testUsers.user1.id,
        content: validContent,
        mediaUrls: null,
        author: {
          id: testUsers.user1.id,
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          profileImage: null,
          role: { name: "STAFF" },
        },
        channel: {
          id: channelId,
          name: "General",
          color: "#3B82F6",
          icon: "💬",
        },
      };

      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await createPost({
        channelId,
        content: validContent,
      });

      expect(result.success).toBe(true);
      expect(result.post).toBeDefined();
      expect(result.post?.content).toBe(validContent);
      expect(revalidatePath).toHaveBeenCalledWith("/posts");
    });

    it("should validate channel access", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      const result = await createPost({
        channelId: "clnnonexist1234567890",
        content: validContent,
      });

      expect(result.error).toBe("Channel not found");
    });

    it("should prevent posting to archived channel", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.channel.findUnique.mockResolvedValue({
        id: channelId,
        name: "Archived",
        archived: true,
      });

      const result = await createPost({
        channelId,
        content: validContent,
      });

      expect(result.error).toBe("Cannot post to an archived channel");
    });

    it("should validate content is not empty", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);

      const result = await createPost({
        channelId,
        content: "",
      });

      expect(result.error).toContain("Post content cannot be empty");
    });

    it("should validate content length", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);

      const longContent = "a".repeat(2001); // Exceeds MAX_POST_LENGTH (2000)

      const result = await createPost({
        channelId,
        content: longContent,
      });

      expect(result.error).toContain("must not exceed 2000 characters");
    });

    it("should handle media URLs correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.channel.findUnique.mockResolvedValue({
        id: channelId,
        name: "General",
        archived: false,
      });

      const mediaUrls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ];

      mockPrisma.post.create.mockResolvedValue({
        id: "new-post-id",
        channelId,
        authorId: testUsers.user1.id,
        content: validContent,
        mediaUrls: JSON.stringify(mediaUrls),
        author: {
          id: testUsers.user1.id,
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          profileImage: null,
          role: { name: "STAFF" },
        },
        channel: {
          id: channelId,
          name: "General",
          color: "#3B82F6",
          icon: "💬",
        },
      });

      const result = await createPost({
        channelId,
        content: validContent,
        mediaUrls,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mediaUrls: JSON.stringify(mediaUrls),
          }),
        })
      );
    });

    it("should check permission to create posts", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(false);

      const result = await createPost({
        channelId,
        content: validContent,
      });

      expect(result.error).toBe("You don't have permission to create posts");
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.channel.findUnique.mockResolvedValue({
        id: channelId,
        name: "General",
        archived: false,
      });

      mockPrisma.post.create.mockRejectedValue(new Error("Database error"));

      const result = await createPost({
        channelId,
        content: validContent,
      });

      expect(result.error).toBe("Failed to create post");
    });
  });

  // ==========================================================================
  // updatePost() - Update own post
  // ==========================================================================
  describe("updatePost()", () => {
    const postId = "clnupdate1234567890a";
    const newContent = "Updated post content";

    it("should update own post successfully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user1.id,
        content: "Original content",
      });

      const mockUpdatedPost = {
        id: postId,
        authorId: testUsers.user1.id,
        content: newContent,
        edited: true,
        editedAt: new Date(),
        author: {
          id: testUsers.user1.id,
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          profileImage: null,
          role: { name: "STAFF" },
        },
        channel: {
          id: "channel-1",
          name: "General",
          color: "#3B82F6",
          icon: "💬",
        },
      };

      mockPrisma.post.update.mockResolvedValue(mockUpdatedPost);

      const result = await updatePost({
        id: postId,
        content: newContent,
      });

      expect(result.success).toBe(true);
      expect(result.post?.content).toBe(newContent);
      expect(result.post?.edited).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/posts");
    });

    it("should not allow updating other user's post", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user2.id, // Different user
        content: "Original content",
      });

      const result = await updatePost({
        id: postId,
        content: newContent,
      });

      expect(result.error).toBe("You can only edit your own posts");
    });

    it("should validate content is not empty", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const result = await updatePost({
        id: postId,
        content: "",
      });

      expect(result.error).toContain("Post content cannot be empty");
    });

    it("should validate content length", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      const longContent = "a".repeat(2001);

      const result = await updatePost({
        id: postId,
        content: longContent,
      });

      expect(result.error).toContain("must not exceed 2000 characters");
    });

    it("should return error for non-existent post", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockPrisma.post.findUnique.mockResolvedValue(null);

      const result = await updatePost({
        id: "clnnonexist9876543210",
        content: newContent,
      });

      expect(result.error).toBe("Post not found");
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user1.id,
        content: "Original content",
      });

      mockPrisma.post.update.mockRejectedValue(new Error("Database error"));

      const result = await updatePost({
        id: postId,
        content: newContent,
      });

      expect(result.error).toBe("Failed to update post");
    });
  });

  // ==========================================================================
  // deletePost() - Delete post with permission checks
  // ==========================================================================
  describe("deletePost()", () => {
    const postId = "clndelete1234567890a";

    it("should delete own post successfully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockCanAccess.mockResolvedValue(false); // Not a manager

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user1.id,
      });

      mockPrisma.post.delete.mockResolvedValue({
        id: postId,
      });

      const result = await deletePost({ id: postId });

      expect(result.success).toBe(true);
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: postId },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/posts");
    });

    it("should allow manager to delete any post in their venue", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3); // Manager
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user3.id,
      ]);
      mockCanAccess.mockResolvedValue(true); // Has manage permission

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user1.id, // Different user
      });

      mockPrisma.post.delete.mockResolvedValue({
        id: postId,
      });

      const result = await deletePost({ id: postId });

      expect(result.success).toBe(true);
    });

    it("should not allow deleting post from other venue", async () => {
      // User 2 in Venue B
      mockRequireAuth.mockResolvedValue(testUsers.user2);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]);

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user3.id, // User 3 in Venue A only
      });

      const result = await deletePost({ id: postId });

      expect(result.error).toBe("Post not found");
    });

    it("should not allow staff to delete other user's posts", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]);
      mockCanAccess.mockResolvedValue(false); // No manage permission

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user2.id, // Different user
      });

      const result = await deletePost({ id: postId });

      expect(result.error).toBe("You don't have permission to delete this post");
    });

    it("should return error for non-existent post", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockPrisma.post.findUnique.mockResolvedValue(null);

      const result = await deletePost({ id: "clnnonexist5555555555" });

      expect(result.error).toBe("Post not found");
    });

    it("should cascade delete comments and reactions", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockCanAccess.mockResolvedValue(false);

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user1.id,
      });

      mockPrisma.post.delete.mockResolvedValue({
        id: postId,
      });

      const result = await deletePost({ id: postId });

      expect(result.success).toBe(true);
      // Cascade should be handled by Prisma schema
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: postId },
      });
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);
      mockCanAccess.mockResolvedValue(false);

      mockPrisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: testUsers.user1.id,
      });

      mockPrisma.post.delete.mockRejectedValue(new Error("Database error"));

      const result = await deletePost({ id: postId });

      expect(result.error).toBe("Failed to delete post");
    });
  });

  // ==========================================================================
  // pinPost() - Pin/unpin posts (manager only)
  // ==========================================================================
  describe("pinPost()", () => {
    const postId = "clnpinpost1234567890";

    it("should allow manager to pin post in their venue", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3); // Manager
      mockCanAccess.mockResolvedValue(true); // Has manage permission

      const mockPost = {
        id: postId,
        pinned: true,
      };

      mockPrisma.post.update.mockResolvedValue(mockPost);

      const result = await pinPost({
        id: postId,
        pinned: true,
      });

      expect(result.success).toBe(true);
      expect(result.post?.pinned).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/posts");
    });

    it("should allow manager to unpin post", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3); // Manager
      mockCanAccess.mockResolvedValue(true);

      const mockPost = {
        id: postId,
        pinned: false,
      };

      mockPrisma.post.update.mockResolvedValue(mockPost);

      const result = await pinPost({
        id: postId,
        pinned: false,
      });

      expect(result.success).toBe(true);
      expect(result.post?.pinned).toBe(false);
    });

    it("should not allow staff to pin posts", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1); // Staff
      mockCanAccess.mockResolvedValue(false); // No manage permission

      const result = await pinPost({
        id: postId,
        pinned: true,
      });

      expect(result.error).toBe("You don't have permission to pin posts");
    });

    it("should return error for non-existent post", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3); // Manager
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.post.update.mockRejectedValue(new Error("Record not found"));

      const result = await pinPost({
        id: "clnnonexist3333333333",
        pinned: true,
      });

      expect(result.error).toBe("Failed to pin post");
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user3);
      mockCanAccess.mockResolvedValue(true);

      mockPrisma.post.update.mockRejectedValue(new Error("Database error"));

      const result = await pinPost({
        id: postId,
        pinned: true,
      });

      expect(result.error).toBe("Failed to pin post");
    });
  });

  // ==========================================================================
  // getPostStats() - Get statistics with venue filtering
  // ==========================================================================
  describe("getPostStats()", () => {
    it("should return stats for shared venue users only", async () => {
      // User 1 in Venue A and B
      mockRequireAuth.mockResolvedValue(testUsers.user1);

      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
        testUsers.user3.id,
      ]);

      // Mock counts
      mockPrisma.post.count
        .mockResolvedValueOnce(15) // Total posts from shared venue users
        .mockResolvedValueOnce(5); // My posts

      mockPrisma.comment.count.mockResolvedValue(8); // My comments

      const result = await getPostStats();

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        totalPosts: 15,
        myPosts: 5,
        myComments: 8,
      });

      // Verify venue filtering
      expect(mockPrisma.post.count).toHaveBeenCalledWith({
        where: {
          authorId: {
            in: [testUsers.user1.id, testUsers.user2.id, testUsers.user3.id],
          },
        },
      });
    });

    it("should count posts correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user2);
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]);

      mockPrisma.post.count
        .mockResolvedValueOnce(10) // Total
        .mockResolvedValueOnce(3); // My posts

      mockPrisma.comment.count.mockResolvedValue(5);

      const result = await getPostStats();

      expect(result.success).toBe(true);
      expect(result.stats?.totalPosts).toBe(10);
      expect(result.stats?.myPosts).toBe(3);
    });

    it("should count comments correctly", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);

      mockPrisma.post.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);

      mockPrisma.comment.count.mockResolvedValue(12);

      const result = await getPostStats();

      expect(result.success).toBe(true);
      expect(result.stats?.myComments).toBe(12);

      expect(mockPrisma.comment.count).toHaveBeenCalledWith({
        where: { userId: testUsers.user1.id },
      });
    });

    it("should exclude data from other venues", async () => {
      // User 2 only in Venue B
      mockRequireAuth.mockResolvedValue(testUsers.user2);

      // Only shares Venue B with user1
      mockGetSharedVenueUsers.mockResolvedValue([
        testUsers.user1.id,
        testUsers.user2.id,
      ]);

      mockPrisma.post.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(3);

      mockPrisma.comment.count.mockResolvedValue(4);

      const result = await getPostStats();

      expect(result.success).toBe(true);

      // Should NOT include user3's posts (Venue A only)
      const call = mockPrisma.post.count.mock.calls[0][0];
      expect(call.where.authorId.in).not.toContain(testUsers.user3.id);
    });

    it("should return zero stats for user with no venues", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user5);
      mockGetSharedVenueUsers.mockResolvedValue([]);

      mockPrisma.post.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPrisma.comment.count.mockResolvedValue(0);

      const result = await getPostStats();

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        totalPosts: 0,
        myPosts: 0,
        myComments: 0,
      });
    });

    it("should handle database errors gracefully", async () => {
      mockRequireAuth.mockResolvedValue(testUsers.user1);
      mockGetSharedVenueUsers.mockResolvedValue([testUsers.user1.id]);

      mockPrisma.post.count.mockRejectedValue(new Error("Database error"));

      const result = await getPostStats();

      expect(result.error).toBe("Failed to fetch statistics");
    });
  });
});
