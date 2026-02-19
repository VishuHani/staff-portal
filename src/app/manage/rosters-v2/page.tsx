import { requireAuth } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RostersV2Client } from "./rosters-v2-client";

export const dynamic = "force-dynamic";

export default async function RosterV2Page() {
  const user = await requireAuth();

  // Get user's venues
  const isAdmin = user.role.name === "ADMIN";
  
  const venues = isAdmin
    ? await prisma.venue.findMany({
        where: { active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      })
    : user.venues.map((uv) => ({
        id: uv.venue.id,
        name: uv.venue.name,
        code: uv.venue.code,
      }));

  return (
    <DashboardLayout user={user}>
      <RostersV2Client venues={venues} />
    </DashboardLayout>
  );
}
