"use server";

import { prisma } from "@/lib/prisma";

/**
 * Get all active venues from the database
 */
export async function getActiveVenues() {
  return await prisma.venue.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
