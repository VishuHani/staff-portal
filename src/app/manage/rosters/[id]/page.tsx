import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RosterEditorClient } from "./roster-editor-client";
import { getRosterById, getVenueStaff } from "@/lib/actions/rosters";
import { getPositions } from "@/lib/actions/venues/position-actions";
import { prisma } from "@/lib/prisma";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, getDay } from "date-fns";

export const metadata = {
  title: "Edit Roster | Team Management",
  description: "View and edit roster details",
};

interface RosterPageProps {
  params: Promise<{ id: string }>;
}

// Venue pay config interface for super calculations
interface VenuePayConfig {
  superRate: number | null;
  superEnabled: boolean;
  defaultWeekdayRate: number | null;
  defaultSaturdayRate: number | null;
  defaultSundayRate: number | null;
  defaultPublicHolidayRate: number | null;
}

// Helper to convert Decimal fields to numbers for client components
function serializeStaffMember(member: any) {
  return {
    ...member,
    weekdayRate: member.weekdayRate ? Number(member.weekdayRate) : null,
    saturdayRate: member.saturdayRate ? Number(member.saturdayRate) : null,
    sundayRate: member.sundayRate ? Number(member.sundayRate) : null,
    publicHolidayRate: member.publicHolidayRate ? Number(member.publicHolidayRate) : null,
    overtimeRate: member.overtimeRate ? Number(member.overtimeRate) : null,
    lateRate: member.lateRate ? Number(member.lateRate) : null,
    superEnabled: member.superEnabled,
    customSuperRate: member.customSuperRate ? Number(member.customSuperRate) : null,
  };
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { id } = await params;
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("rosters", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Fetch roster
  const result = await getRosterById(id);

  if (!result.success || !result.roster) {
    notFound();
  }

  const roster = result.roster;

  // Check if user can edit
  const canEdit = await canAccess("rosters", "edit");
  const canPublish = await canAccess("rosters", "publish");

  // Fetch staff for the venue with super settings
  const staffResult = await getVenueStaff(roster.venueId);
  const rawStaff = staffResult.success ? staffResult.staff : [];
  const staff = rawStaff.map(serializeStaffMember);

  // Fetch positions for the venue
  const positionsResult = await getPositions(roster.venueId);
  const positionColors = positionsResult.success
    ? positionsResult.positions.map((p) => ({ name: p.name, color: p.color }))
    : [];
  const positions = positionsResult.success ? positionsResult.positions : [];

  // Build staff pay rates map with super settings
  const staffPayRates: Record<string, any> = {};
  staff.forEach((member: any) => {
    staffPayRates[member.id] = {
      weekdayRate: member.weekdayRate,
      saturdayRate: member.saturdayRate,
      sundayRate: member.sundayRate,
      superEnabled: member.superEnabled,
      customSuperRate: member.customSuperRate,
    };
  });

  // Fetch venue pay config with super settings
  const venuePayConfigRaw = await prisma.venuePayConfig.findUnique({
    where: { venueId: roster.venueId },
  });

  const venuePayConfig: VenuePayConfig | null = venuePayConfigRaw ? {
    superRate: venuePayConfigRaw.superRate ? Number(venuePayConfigRaw.superRate) : null,
    superEnabled: venuePayConfigRaw.superEnabled ?? true,
    defaultWeekdayRate: venuePayConfigRaw.defaultWeekdayRate ? Number(venuePayConfigRaw.defaultWeekdayRate) : null,
    defaultSaturdayRate: venuePayConfigRaw.defaultSaturdayRate ? Number(venuePayConfigRaw.defaultSaturdayRate) : null,
    defaultSundayRate: venuePayConfigRaw.defaultSundayRate ? Number(venuePayConfigRaw.defaultSundayRate) : null,
    defaultPublicHolidayRate: venuePayConfigRaw.defaultPublicHolidayRate ? Number(venuePayConfigRaw.defaultPublicHolidayRate) : null,
  } : null;

  // Fetch staff availability for the roster week
  // Availability is stored by dayOfWeek (0=Sunday, 6=Saturday)
  const rosterStart = new Date(roster.startDate);
  const rosterEnd = new Date(roster.endDate);
  
  // Get all days in the roster week
  const staffIds = staff.map((s: any) => s.id);
  
  const availabilityRecords = await prisma.availability.findMany({
    where: {
      userId: { in: staffIds },
    },
  });

  // Build staff availability map: userId -> dateKey -> status
  // Convert dayOfWeek to actual dates within the roster week
  const staffAvailability: Record<string, Record<string, { available: boolean; startTime?: string; endTime?: string; notes?: string }>> = {};
  
  // Initialize for all staff
  staffIds.forEach((staffId: string) => {
    staffAvailability[staffId] = {};
  });
  
  // For each day in the roster week, map availability
  let currentDate = new Date(rosterStart);
  while (currentDate <= rosterEnd) {
    const dateKey = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = getDay(currentDate); // 0=Sunday, 6=Saturday
    
    availabilityRecords.forEach((record) => {
      if (record.dayOfWeek === dayOfWeek) {
        if (!staffAvailability[record.userId]) {
          staffAvailability[record.userId] = {};
        }
        staffAvailability[record.userId][dateKey] = {
          available: record.isAvailable,
          startTime: record.startTime || undefined,
          endTime: record.endTime || undefined,
        };
      }
    });
    
    currentDate = addDays(currentDate, 1);
  }

  // Fetch time-off entries for staff members
  const timeOffRecords = await prisma.timeOffRequest.findMany({
    where: {
      userId: { in: staffIds },
      OR: [
        // Starts or ends within the roster week
        {
          startDate: { lte: rosterEnd },
          endDate: { gte: rosterStart },
        },
      ],
      status: "APPROVED",
    },
  });

  // Build staff time-off map: userId -> time-off entries
  const staffTimeOff: Record<string, Array<{ id: string; startDate: Date; endDate: Date; type: string; status: string }>> = {};
  timeOffRecords.forEach((record) => {
    if (!staffTimeOff[record.userId]) {
      staffTimeOff[record.userId] = [];
    }
    staffTimeOff[record.userId].push({
      id: record.id,
      startDate: record.startDate,
      endDate: record.endDate,
      type: record.type,
      status: record.status,
    });
  });

  return (
    <DashboardLayout user={user}>
      <RosterEditorClient
        roster={roster}
        staff={staff}
        canEdit={canEdit}
        canPublish={canPublish}
        userRole={user.role.name}
        userId={user.id}
        positionColors={positionColors}
        positions={positions}
        staffPayRates={staffPayRates}
        venuePayConfig={venuePayConfig}
        staffAvailability={staffAvailability}
        staffTimeOff={staffTimeOff}
      />
    </DashboardLayout>
  );
}
