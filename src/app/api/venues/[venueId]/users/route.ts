import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasAnyPermission, isAdmin } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/utils/api-response";
import { normalizePagination } from "@/lib/utils/pagination";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Unauthorized", 401);
    }

    const { venueId } = await params;

    // Check if user has access to this venue
    const isUserAdmin = await isAdmin(user.id);

    if (!isUserAdmin) {
      const hasAccess = await hasAnyPermission(user.id, [
        { resource: "documents", action: "assign" },
      ]);

      if (!hasAccess) {
        // Check if user belongs to this venue
        const userVenue = await prisma.userVenue.findFirst({
          where: { userId: user.id, venueId },
        });

        if (!userVenue) {
          return apiError("Forbidden", 403);
        }
      }
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const pagination = normalizePagination(
      {
        page: searchParams.get("page")
          ? Number(searchParams.get("page"))
          : undefined,
        limit: searchParams.get("limit")
          ? Number(searchParams.get("limit"))
          : undefined,
      },
      {
        defaultLimit: 50,
        maxLimit: 200,
      }
    );

    const where = {
      venueId,
      ...(includeInactive ? {} : { user: { active: true } }),
    };

    // Get users for this venue through UserVenue relation
    const [total, userVenues] = await Promise.all([
      prisma.userVenue.count({ where }),
      prisma.userVenue.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              active: true,
              roleId: true,
              role: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    // Filter and transform users
    const users = userVenues
      .map((uv) => ({
        id: uv.user.id,
        firstName: uv.user.firstName || "",
        lastName: uv.user.lastName || "",
        email: uv.user.email,
        role: uv.user.role?.name || "STAFF",
        active: uv.user.active,
      }));

    return apiSuccess({
      users,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      hasMore: pagination.page * pagination.limit < total,
    });
  } catch (error) {
    console.error("Error fetching venue users:", error);
    return apiError("Failed to fetch users");
  }
}
