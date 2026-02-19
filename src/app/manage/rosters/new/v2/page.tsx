import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { NewRosterV2Client } from "./new-roster-v2-client";

export const dynamic = "force-dynamic";

interface NewRosterV2PageProps {
  searchParams: Promise<{ venueId?: string }>;
}

export default async function NewRosterV2Page({ searchParams }: NewRosterV2PageProps) {
  const user = await requireAuth();

  // Next.js 16 requires awaiting searchParams
  const { venueId } = await searchParams;

  // Get user's venues
  const isAdmin = user.role.name === "ADMIN";
  
  let venues = isAdmin
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

  // If venueId is provided, filter to just that venue
  if (venueId) {
    const selectedVenue = venues.find(v => v.id === venueId);
    if (selectedVenue) {
      venues = [selectedVenue];
    } else {
      redirect("/manage/rosters");
    }
  }

  return (
    <div className="container max-w-6xl py-6">
      <NewRosterV2Client venues={venues} />
    </div>
  );
}
