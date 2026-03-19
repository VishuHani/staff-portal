import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues } from "../../helpers/fixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
    },
    reaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: vi.fn(),
  canAccess: vi.fn(),
}));

vi.mock("@/lib/utils/venue", () => ({
  getAccessibleChannelIds: vi.fn(),
}));

vi.mock("@/lib/services/notifications", () => ({
  notifyMessageReaction: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getAccessibleChannelIds } from "@/lib/utils/venue";
import { addReaction, getReactionsByCommentId, toggleCommentReaction } from "@/lib/actions/reactions";

describe("Reaction tenant integrity", () => {
  const mockPrisma = prisma as any;
  const mockRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;
  const mockCanAccess = canAccess as unknown as ReturnType<typeof vi.fn>;
  const mockGetAccessibleChannelIds = getAccessibleChannelIds as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(testUsers.user1);
    mockCanAccess.mockResolvedValue(true);
  });

  it("denies adding a reaction to a post in another venue", async () => {
    mockGetAccessibleChannelIds.mockResolvedValue([testVenues.venueB.id]);
    mockPrisma.post.findUnique.mockResolvedValue({
      channelId: testVenues.venueA.id,
      author: { id: testUsers.user3.id },
    });

    const result = await addReaction({
      postId: "c12345678901234567890123a",
      emoji: "👍",
    });

    expect(result.error).toMatch(/post not found/i);
    expect(mockPrisma.reaction.create).not.toHaveBeenCalled();
  });

  it("denies reading reactions for a comment in another venue", async () => {
    mockGetAccessibleChannelIds.mockResolvedValue([testVenues.venueB.id]);
    mockPrisma.comment.findUnique.mockResolvedValue({
      post: { channelId: testVenues.venueA.id },
    });

    const result = await getReactionsByCommentId("c12345678901234567890123a");

    expect(result.error).toMatch(/comment not found/i);
    expect(mockPrisma.reaction.findMany).not.toHaveBeenCalled();
  });

  it("denies toggling a comment reaction in another venue", async () => {
    mockGetAccessibleChannelIds.mockResolvedValue([testVenues.venueB.id]);
    mockPrisma.comment.findUnique.mockResolvedValue({
      user: { id: testUsers.user3.id },
      post: { channelId: testVenues.venueA.id },
    });

    const result = await toggleCommentReaction({
      commentId: "c12345678901234567890123a",
      emoji: "❤️",
    });

    expect(result.error).toMatch(/comment not found/i);
    expect(mockPrisma.reaction.create).not.toHaveBeenCalled();
  });
});
