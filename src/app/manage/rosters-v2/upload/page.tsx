import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { UploadClient } from "./upload-client";

export const dynamic = "force-dynamic";

interface UploadPageProps {
  searchParams: Promise<{ venueId?: string }>;
}

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const user = await requireAuth();
  
  // Next.js 16 requires awaiting searchParams
  const { venueId } = await searchParams;

  if (!venueId) {
    redirect("/manage/rosters-v2");
  }

  // Get user's venues
  const isAdmin = user.role.name === "ADMIN";
  
  // Verify venue access
  const venue = isAdmin
    ? await prisma.venue.findUnique({
        where: { id: venueId },
        select: { id: true, name: true },
      })
    : user.venues.find((uv) => uv.venue.id === venueId)?.venue;

  if (!venue) {
    redirect("/manage/rosters-v2");
  }

  return (
    <DashboardLayout user={user}>
      <UploadClient venueId={venue.id} venueName={venue.name} />
    </DashboardLayout>
  );
}
