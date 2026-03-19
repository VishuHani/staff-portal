import { beforeEach, describe, expect, it, vi } from "vitest";
import { testUsers, testVenues } from "../../helpers/fixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inviteSettings: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    venue: {
      findMany: vi.fn(),
    },
    userVenue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    userInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/email/brevo", () => ({
  sendBrevoEmail: vi.fn(),
}));

vi.mock("@/lib/services/email/templates", () => ({
  getInvitationEmailTemplate: vi.fn(() => ({
    subject: "Invite",
    htmlContent: "<p>Invite</p>",
  })),
}));

import { requireAuth, isAdmin } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  createInvitation,
} from "@/lib/actions/invites";

describe("invites tenant integrity", () => {
  type MockFn = ReturnType<typeof vi.fn>;
  type MockPrisma = {
    inviteSettings: {
      findFirst: MockFn;
      create: MockFn;
    };
    venue: {
      findMany: MockFn;
    };
    userVenue: {
      findMany: MockFn;
      findUnique: MockFn;
      count: MockFn;
      create: MockFn;
    };
    userInvitation: {
      findFirst: MockFn;
      findUnique: MockFn;
      create: MockFn;
      update: MockFn;
    };
    user: {
      findUnique: MockFn;
    };
    role: {
      findFirst: MockFn;
    };
  };

  const mockRequireAuth = requireAuth as unknown as MockFn;
  const mockIsAdmin = isAdmin as unknown as MockFn;
  const mockHasPermission = hasPermission as unknown as MockFn;
  const mockPrisma = prisma as unknown as MockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(testUsers.user3);
    mockIsAdmin.mockResolvedValue(false);
    mockHasPermission.mockResolvedValue(true);
    mockPrisma.inviteSettings.findFirst.mockResolvedValue({
      invitationExpirationDays: 7,
    });
    mockPrisma.userVenue.findMany.mockResolvedValue([
      { venueId: testVenues.venueA.id },
    ]);
    mockPrisma.role.findFirst.mockResolvedValue({ id: "role-staff", name: "STAFF" });
  });

  it("scopes active invitation reuse to the target venue", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.userInvitation.findFirst.mockResolvedValue(null);
    mockPrisma.userInvitation.create.mockResolvedValue({
      id: "invite-1",
      venue: { id: testVenues.venueA.id, name: testVenues.venueA.name },
      role: { id: "role-staff", name: "STAFF" },
      inviter: {
        id: testUsers.user3.id,
        firstName: "Test",
        lastName: "User",
        email: testUsers.user3.email,
      },
    });

    await createInvitation({
      email: "newhire@example.com",
      scope: "VENUE",
      venueId: testVenues.venueA.id,
      roleId: "role-staff",
      documentIds: [],
    });

    expect(mockPrisma.userInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "newhire@example.com",
          venueId: testVenues.venueA.id,
          status: "PENDING",
        }),
      })
    );
  });

  it("rejects invitation acceptance when the signed-in user email does not match", async () => {
    mockPrisma.userInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      email: "invitee@example.com",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scope: "VENUE",
      venueId: testVenues.venueA.id,
      documentIds: [],
      venue: { id: testVenues.venueA.id, name: testVenues.venueA.name },
      role: { id: "role-staff", name: "STAFF" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: testUsers.user3.id,
      email: "other@example.com",
    });

    const result = await acceptInvitation("token-1", testUsers.user3.id);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not match/i);
    expect(mockPrisma.userInvitation.update).not.toHaveBeenCalled();
  });
});
