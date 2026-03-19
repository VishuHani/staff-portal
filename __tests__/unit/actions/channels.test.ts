import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues } from "../../helpers/fixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    channel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    channelVenue: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    post: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: vi.fn(),
  canAccess: vi.fn(),
  canAccessAdmin: vi.fn(),
}));

vi.mock("@/lib/utils/venue", () => ({
  getAccessibleChannelIds: vi.fn(),
  getUserVenueIds: vi.fn(),
}));

vi.mock("@/lib/actions/admin/audit-logs", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/utils/audit-helpers", () => ({
  getAuditContext: vi.fn().mockResolvedValue({ ipAddress: "127.0.0.1" }),
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { requireAuth, canAccess, canAccessAdmin } from "@/lib/rbac/access";
import { getAccessibleChannelIds, getUserVenueIds } from "@/lib/utils/venue";
import { getChannelById, updateChannel } from "@/lib/actions/channels";

describe("Channel management tenant authz", () => {
  const mockPrisma = prisma as any;
  const mockGetCurrentUser = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
  const mockRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;
  const mockCanAccess = canAccess as unknown as ReturnType<typeof vi.fn>;
  const mockCanAccessAdmin = canAccessAdmin as unknown as ReturnType<typeof vi.fn>;
  const mockGetAccessibleChannelIds = getAccessibleChannelIds as unknown as ReturnType<typeof vi.fn>;
  const mockGetUserVenueIds = getUserVenueIds as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(testUsers.user3);
    mockGetCurrentUser.mockResolvedValue(testUsers.user3);
    mockCanAccess.mockResolvedValue(true);
    mockCanAccessAdmin.mockResolvedValue(false);
    mockGetAccessibleChannelIds.mockResolvedValue([testVenues.venueB.id]);
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueB.id]);
  });

  it("denies reading a channel from another venue", async () => {
    mockPrisma.channel.findUnique.mockResolvedValue({
      id: "channel-a",
      name: "Venue A Channel",
      isPublic: false,
      archived: false,
      venues: [{ venueId: testVenues.venueA.id }],
      _count: { posts: 0 },
    });

    const result = await getChannelById("channel-a");

    expect(result.error).toMatch(/channel not found/i);
  });

  it("denies updating a channel from another venue", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: testUsers.user3.id,
      role: { name: "MANAGER" },
      venues: [
        {
          venue: { id: testVenues.venueB.id },
        },
      ],
    });
    mockPrisma.channel.findUnique.mockResolvedValue({
      id: "clnchannel12345678",
      name: "Venue A Channel",
      isPublic: false,
      archived: false,
      venues: [{ venueId: testVenues.venueA.id }],
    });

    const result = await updateChannel({
      id: "clnchannel12345678",
      name: "Updated Name",
    });

    expect(result.error).toMatch(/channel not found|invalid channel id/i);
    expect(mockPrisma.channel.update).not.toHaveBeenCalled();
  });
});
