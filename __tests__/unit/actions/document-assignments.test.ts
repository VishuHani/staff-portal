import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues } from "../../helpers/fixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    documentTemplate: {
      findUnique: vi.fn(),
    },
    documentBundle: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    venue: {
      findUnique: vi.fn(),
    },
    userInvitation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
    documentAuditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rbac/permissions", () => ({
  isAdmin: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/utils/venue", () => ({
  getUserVenueIds: vi.fn(),
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

import { getCurrentUser } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, hasPermission } from "@/lib/rbac/permissions";
import { getUserVenueIds } from "@/lib/utils/venue";
import {
  createProspectiveUserAssignment,
  getProspectiveUsers,
  linkDocumentAssignmentsToUser,
  resendProspectiveUserInvitation,
} from "@/lib/actions/documents/assignments";

describe("Document assignment tenant integrity", () => {
  const mockGetCurrentUser = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
  const mockPrisma = prisma as any;
  const mockIsAdmin = isAdmin as unknown as ReturnType<typeof vi.fn>;
  const mockHasPermission = hasPermission as unknown as ReturnType<typeof vi.fn>;
  const mockGetUserVenueIds = getUserVenueIds as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(testUsers.user3);
    mockIsAdmin.mockResolvedValue(false);
    mockHasPermission.mockResolvedValue(true);
    mockPrisma.role.findFirst.mockResolvedValue({ id: "role-staff", name: "STAFF" });
    mockPrisma.venue.findUnique.mockResolvedValue({ name: testVenues.venueA.name });
  });

  it("filters prospective users to the caller's venues when no venue is specified", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueA.id]);
    mockPrisma.documentAssignment.findMany.mockResolvedValue([
      {
        id: "assign-a",
        email: "prospect@example.com",
        templateId: null,
        bundleId: null,
        venueId: testVenues.venueA.id,
        status: "PENDING",
        dueDate: null,
        assignedAt: new Date(),
        invitationId: null,
        template: null,
        bundle: null,
        venue: { id: testVenues.venueA.id, name: testVenues.venueA.name },
        invitation: null,
      },
    ]);

    const result = await getProspectiveUsers();

    expect(result.success).toBe(true);
    expect(mockPrisma.documentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venueId: { in: [testVenues.venueA.id] },
        }),
      })
    );
  });

  it("denies prospective assignment creation for a foreign venue", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueB.id]);

    const result = await createProspectiveUserAssignment({
      templateId: "c12345678901234567890123a",
      email: "newhire@example.com",
      venueId: testVenues.venueA.id,
      sendInvitation: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission/i);
    expect(mockPrisma.documentTemplate.findUnique).not.toHaveBeenCalled();
  });

  it("only links prospective assignments for venues the user owns", async () => {
    mockIsAdmin.mockResolvedValue(false);
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueA.id]);
    mockPrisma.documentAssignment.findMany.mockResolvedValue([
      {
        id: "assign-a",
        email: "prospect@example.com",
        templateId: null,
        bundleId: null,
        venueId: testVenues.venueA.id,
        status: "PENDING",
        dueDate: null,
        assignedAt: new Date(),
        invitationId: null,
        template: null,
        bundle: null,
        venue: { id: testVenues.venueA.id, name: testVenues.venueA.name },
        invitation: null,
      },
    ]);
    mockPrisma.documentAssignment.updateMany.mockResolvedValue({ count: 1 });

    const result = await linkDocumentAssignmentsToUser(
      testUsers.user1.id,
      "prospect@example.com"
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.documentAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venueId: { in: [testVenues.venueA.id] },
        }),
      })
    );
  });

  it("scopes prospective invite reuse to the target venue", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueA.id]);
    mockPrisma.userInvitation.findFirst.mockResolvedValue(null);
    mockPrisma.userInvitation.create.mockResolvedValue({ id: "invite-new" });
    mockPrisma.documentTemplate.findUnique.mockResolvedValue({
      currentVersion: 1,
      venueId: testVenues.venueA.id,
      isActive: true,
      name: "Form A",
    });
    mockPrisma.documentAssignment.create.mockResolvedValue({
      id: "assignment-new",
      email: "prospect@example.com",
      venueId: testVenues.venueA.id,
      venue: { id: testVenues.venueA.id, name: testVenues.venueA.name },
      assignedByUser: { id: testUsers.user3.id, firstName: "User", lastName: "Three" },
    });
    mockPrisma.documentAuditLog.create.mockResolvedValue({});

    await createProspectiveUserAssignment({
      templateId: "c12345678901234567890123a",
      email: "prospect@example.com",
      venueId: testVenues.venueA.id,
      sendInvitation: true,
    });

    expect(mockPrisma.userInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "prospect@example.com",
          venueId: testVenues.venueA.id,
        }),
      })
    );
  });

  it("keeps resend invitation reuse scoped to the venue", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueA.id]);
    mockPrisma.venue.findUnique.mockResolvedValue({ name: testVenues.venueA.name });
    mockPrisma.userInvitation.findFirst.mockResolvedValue(null);
    mockPrisma.role.findFirst.mockResolvedValue({ id: "role-staff", name: "STAFF" });
    mockPrisma.userInvitation.create.mockResolvedValue({ id: "invite-1" });
    mockPrisma.documentAssignment.updateMany.mockResolvedValue({ count: 1 });

    const result = await resendProspectiveUserInvitation(
      "prospect@example.com",
      testVenues.venueA.id
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.userInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "prospect@example.com",
          venueId: testVenues.venueA.id,
        }),
      })
    );
  });
});
