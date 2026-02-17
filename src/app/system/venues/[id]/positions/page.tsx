import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { prisma } from "@/lib/prisma";
import { PositionsPageClient } from "./positions-page-client";
import { getPositions } from "@/lib/actions/venues/position-actions";

export const metadata = {
  title: "Manage Positions | System Settings",
  description: "Manage positions for a venue",
};

interface PositionsPageProps {
  params: Promise<{ id: string }>;
}

export default async function PositionsPage({ params }: PositionsPageProps) {
  const { id: venueId } = await params;
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("stores", "view");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Fetch venue
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, name: true, code: true },
  });

  if (!venue) {
    notFound();
  }

  // Fetch positions
  const positionsResult = await getPositions(venueId);
  const positions = positionsResult.success ? positionsResult.positions : [];

  // Check edit permission
  const canEdit = await canAccess("stores", "update");

  return (
    <DashboardLayout user={user}>
      <PositionsPageClient
        venue={venue}
        positions={positions}
        canEdit={canEdit}
      />
    </DashboardLayout>
  );
}
