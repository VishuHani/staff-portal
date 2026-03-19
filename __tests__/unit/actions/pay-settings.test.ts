import { describe, it, expect, beforeEach, vi } from "vitest";
import { testUsers, testVenues, testRoles } from "../../helpers/fixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    venuePayConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/venue", () => ({
  getUserVenueIds: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserVenueIds } from "@/lib/utils/venue";
import { getVenuePayConfig, updateVenuePayConfig } from "@/lib/actions/admin/venue-pay-config";

describe("Venue pay settings authz", () => {
  const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
  const mockPrisma = prisma as any;
  const mockGetUserVenueIds = getUserVenueIds as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: testUsers.user3.id } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: testUsers.user3.id,
      role: { name: "MANAGER" },
      venuePermissions: [
        {
          permission: { action: "manage", resource: "venue_pay_config" },
        },
      ],
    });
  });

  it("denies reading pay settings for a venue the user does not own", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueB.id]);

    const result = await getVenuePayConfig(testVenues.venueA.id);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authorized/i);
    expect(mockPrisma.venuePayConfig.findUnique).not.toHaveBeenCalled();
  });

  it("allows reading pay settings for an owned venue", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueA.id]);
    mockPrisma.venuePayConfig.findUnique.mockResolvedValue({
      venueId: testVenues.venueA.id,
    });

    const result = await getVenuePayConfig(testVenues.venueA.id);

    expect(result.success).toBe(true);
  });

  it("denies updating pay settings for a foreign venue", async () => {
    mockGetUserVenueIds.mockResolvedValue([testVenues.venueB.id]);

    const result = await updateVenuePayConfig({
      venueId: testVenues.venueA.id,
      defaultWeekdayRate: 30,
      defaultSaturdayRate: 35,
      defaultSundayRate: 40,
      defaultPublicHolidayRate: 50,
      defaultOvertimeRate: 45,
      defaultLateRate: 0,
      overtimeThresholdHours: 8,
      overtimeMultiplier: 1.5,
      lateStartHour: 22,
      autoCalculateBreaks: true,
      breakThresholdHours: 4,
      defaultBreakMinutes: 30,
      publicHolidayRegion: "NSW",
      superEnabled: true,
      superRate: 0.115,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authorized/i);
    expect(mockPrisma.venuePayConfig.upsert).not.toHaveBeenCalled();
  });
});
