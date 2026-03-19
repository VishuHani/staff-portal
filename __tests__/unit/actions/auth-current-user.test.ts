import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockFindUnique } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/supabase-server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

import { getCurrentUser } from "@/lib/actions/auth";

describe("getCurrentUser projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries user with explicit auth-context select projection", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    });

    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      active: true,
      role: { id: "role-1", name: "STAFF", description: null, rolePermissions: [] },
      venue: null,
      venues: [],
    });

    const result = await getCurrentUser();

    expect(result?.id).toBe("user-1");
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        select: expect.objectContaining({
          id: true,
          email: true,
          role: expect.any(Object),
          venues: expect.any(Object),
        }),
      })
    );

    const queryArg = mockFindUnique.mock.calls[0][0];
    expect(queryArg.include).toBeUndefined();
    expect(queryArg.select.weekdayRate).toBeUndefined();
    expect(queryArg.select.superFundABN).toBeUndefined();
  });
});
