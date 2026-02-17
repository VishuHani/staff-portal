import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RosterEditorClient } from "./roster-editor-client";
import { getRosterById, getVenueStaff } from "@/lib/actions/rosters";
import { getPositions } from "@/lib/actions/venues/position-actions";

export const metadata = {
  title: "Edit Roster | Team Management",
  description: "View and edit roster details",
};

interface RosterPageProps {
  params: Promise<{ id: string }>;
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

  // Fetch staff for the venue
  const staffResult = await getVenueStaff(roster.venueId);
  const staff = staffResult.success ? staffResult.staff : [];

  // Fetch positions for the venue
  const positionsResult = await getPositions(roster.venueId);
  const positionColors = positionsResult.success
    ? positionsResult.positions.map((p) => ({ name: p.name, color: p.color }))
    : [];
  const positions = positionsResult.success
    ? positionsResult.positions.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        active: p.active,
      }))
    : [];

  // Build staff pay rates map
  const staffPayRates: Record<string, { weekdayRate: unknown; saturdayRate: unknown; sundayRate: unknown }> = {};
  staff.forEach((member) => {
    if (member.weekdayRate || member.saturdayRate || member.sundayRate) {
      staffPayRates[member.id] = {
        weekdayRate: member.weekdayRate,
        saturdayRate: member.saturdayRate,
        sundayRate: member.sundayRate,
      };
    }
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
      />
    </DashboardLayout>
  );
}
