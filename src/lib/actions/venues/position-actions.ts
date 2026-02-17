"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Validation schemas
const createPositionSchema = z.object({
  name: z.string().min(1, "Position name is required").max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  venueId: z.string().min(1),
});

const updatePositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const reorderPositionsSchema = z.object({
  venueId: z.string().min(1),
  positions: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int().min(0),
  })),
});

// Types
export interface PositionInput {
  name: string;
  color: string;
  venueId: string;
}

export interface Position {
  id: string;
  name: string;
  color: string;
  venueId: string;
  displayOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Get all positions for a venue
export async function getPositions(venueId: string) {
  try {
    await requireAuth();

    const positions = await prisma.position.findMany({
      where: { venueId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return { success: true, positions };
  } catch (error) {
    console.error("Error fetching positions:", error);
    return { success: false, error: "Failed to fetch positions", positions: [] };
  }
}

// Get position by ID
export async function getPositionById(positionId: string) {
  try {
    await requireAuth();

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { venue: { select: { id: true, name: true } } },
    });

    if (!position) {
      return { success: false, error: "Position not found" };
    }

    return { success: true, position };
  } catch (error) {
    console.error("Error fetching position:", error);
    return { success: false, error: "Failed to fetch position" };
  }
}

// Create a new position
export async function createPosition(data: PositionInput) {
  try {
    const user = await requireAuth();

    // Validate input
    const validated = createPositionSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    // Check permission (admin or manager of venue)
    const hasPermission = await canAccess("stores", "update");
    if (!hasPermission) {
      // Check if user is manager of this venue
      const isVenueManager = await prisma.userVenue.findFirst({
        where: {
          userId: user.id,
          venueId: data.venueId,
        },
      });
      if (!isVenueManager && user.role.name !== "ADMIN") {
        return { success: false, error: "You don't have permission to manage positions" };
      }
    }

    // Get max display order
    const maxOrder = await prisma.position.aggregate({
      where: { venueId: data.venueId },
      _max: { displayOrder: true },
    });

    // Check for duplicate name
    const existing = await prisma.position.findFirst({
      where: {
        venueId: data.venueId,
        name: { equals: data.name, mode: "insensitive" },
      },
    });
    if (existing) {
      return { success: false, error: "A position with this name already exists" };
    }

    const position = await prisma.position.create({
      data: {
        name: data.name,
        color: data.color,
        venueId: data.venueId,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    revalidatePath(`/system/venues/${data.venueId}`);
    return { success: true, position };
  } catch (error) {
    console.error("Error creating position:", error);
    return { success: false, error: "Failed to create position" };
  }
}

// Update a position
export async function updatePosition(data: {
  id: string;
  name?: string;
  color?: string;
  displayOrder?: number;
  active?: boolean;
}) {
  try {
    const user = await requireAuth();

    // Validate input
    const validated = updatePositionSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    // Get current position
    const current = await prisma.position.findUnique({
      where: { id: data.id },
    });
    if (!current) {
      return { success: false, error: "Position not found" };
    }

    // Check permission
    const hasPermission = await canAccess("stores", "update");
    if (!hasPermission) {
      const isVenueManager = await prisma.userVenue.findFirst({
        where: {
          userId: user.id,
          venueId: current.venueId,
        },
      });
      if (!isVenueManager && user.role.name !== "ADMIN") {
        return { success: false, error: "You don't have permission to manage positions" };
      }
    }

    // Check for duplicate name if updating name
    if (data.name && data.name !== current.name) {
      const existing = await prisma.position.findFirst({
        where: {
          venueId: current.venueId,
          name: { equals: data.name, mode: "insensitive" },
          id: { not: data.id },
        },
      });
      if (existing) {
        return { success: false, error: "A position with this name already exists" };
      }
    }

    const position = await prisma.position.update({
      where: { id: data.id },
      data: {
        name: data.name,
        color: data.color,
        displayOrder: data.displayOrder,
        active: data.active,
      },
    });

    revalidatePath(`/system/venues/${current.venueId}`);
    return { success: true, position };
  } catch (error) {
    console.error("Error updating position:", error);
    return { success: false, error: "Failed to update position" };
  }
}

// Reorder positions
export async function reorderPositions(data: {
  venueId: string;
  positions: Array<{ id: string; displayOrder: number }>;
}) {
  try {
    const user = await requireAuth();

    // Validate input
    const validated = reorderPositionsSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    // Check permission
    const hasPermission = await canAccess("stores", "update");
    if (!hasPermission) {
      const isVenueManager = await prisma.userVenue.findFirst({
        where: {
          userId: user.id,
          venueId: data.venueId,
        },
      });
      if (!isVenueManager && user.role.name !== "ADMIN") {
        return { success: false, error: "You don't have permission to manage positions" };
      }
    }

    // Update all positions in a transaction
    await prisma.$transaction(
      data.positions.map((pos) =>
        prisma.position.update({
          where: { id: pos.id },
          data: { displayOrder: pos.displayOrder },
        })
      )
    );

    revalidatePath(`/system/venues/${data.venueId}`);
    return { success: true };
  } catch (error) {
    console.error("Error reordering positions:", error);
    return { success: false, error: "Failed to reorder positions" };
  }
}

// Delete a position
export async function deletePosition(positionId: string) {
  try {
    const user = await requireAuth();

    // Get position
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });
    if (!position) {
      return { success: false, error: "Position not found" };
    }

    // Check permission
    const hasPermission = await canAccess("stores", "update");
    if (!hasPermission) {
      const isVenueManager = await prisma.userVenue.findFirst({
        where: {
          userId: user.id,
          venueId: position.venueId,
        },
      });
      if (!isVenueManager && user.role.name !== "ADMIN") {
        return { success: false, error: "You don't have permission to manage positions" };
      }
    }

    // Check if position is used in any shifts
    const shiftsUsingPosition = await prisma.rosterShift.count({
      where: { position: position.name },
    });

    if (shiftsUsingPosition > 0) {
      return {
        success: false,
        error: `Cannot delete: ${shiftsUsingPosition} shift(s) use this position. Deactivate instead.`,
      };
    }

    await prisma.position.delete({
      where: { id: positionId },
    });

    revalidatePath(`/system/venues/${position.venueId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting position:", error);
    return { success: false, error: "Failed to delete position" };
  }
}

// Get position color by name (for display in matrix)
export async function getPositionColor(venueId: string, positionName: string): Promise<string> {
  const position = await prisma.position.findFirst({
    where: {
      venueId,
      name: { equals: positionName, mode: "insensitive" },
    },
    select: { color: true },
  });

  return position?.color || "#3B82F6"; // Default blue
}

// Get all position colors for a venue as a map
export async function getPositionColorsMap(venueId: string): Promise<Record<string, string>> {
  const positions = await prisma.position.findMany({
    where: { venueId, active: true },
    select: { name: true, color: true },
  });

  const colorMap: Record<string, string> = {};
  positions.forEach((p) => {
    colorMap[p.name.toLowerCase()] = p.color;
  });

  return colorMap;
}
