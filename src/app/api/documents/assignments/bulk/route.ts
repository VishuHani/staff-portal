import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasAnyPermission, isAdmin } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

interface BulkAssignmentRequest {
  venueId: string;
  templateIds: string[];
  bundleIds: string[];
  userIds: string[];
  dueDate: string | null;
  notes: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Unauthorized", 401);
    }

    const body: BulkAssignmentRequest = await request.json();
    const { venueId, templateIds, bundleIds, userIds, dueDate, notes } = body;

    // Validate required fields
    if (!venueId || (!templateIds.length && !bundleIds.length) || !userIds.length) {
      return apiError("Missing required fields", 400);
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    const canAssign = await hasAnyPermission(user.id, [
      { resource: "documents", action: "assign" },
    ]);

    if (!canAssign && !isUserAdmin) {
      return apiError("Forbidden", 403);
    }

    // Verify venue access
    if (!isUserAdmin) {
      const userVenue = await prisma.userVenue.findFirst({
        where: { userId: user.id, venueId },
      });
      if (!userVenue) {
        return apiError("Venue access denied", 403);
      }
    }

    // Get templates and bundles to assign
    const templates = await prisma.documentTemplate.findMany({
      where: {
        id: { in: templateIds },
        venueId,
        isActive: true,
      },
    });

    const bundles = await prisma.documentBundle.findMany({
      where: {
        id: { in: bundleIds },
        venueId,
        isActive: true,
      },
      include: {
        items: {
          include: {
            template: true,
          },
        },
      },
    });

    // Verify users exist and belong to venue
    const venueUsers = await prisma.userVenue.findMany({
      where: {
        venueId,
        userId: { in: userIds },
      },
    });

    const validUserIds = venueUsers.map((vu) => vu.userId);

    if (validUserIds.length === 0) {
      return apiError("No valid users found for this venue", 400);
    }

    // Create assignments
    const assignments = [];
    const dueDateParsed = dueDate ? new Date(dueDate) : null;

    // Assign individual templates
    for (const template of templates) {
      for (const userId of validUserIds) {
        // Check if assignment already exists
        const existing = await prisma.documentAssignment.findFirst({
          where: {
            userId,
            templateId: template.id,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        });

        if (!existing) {
          const assignment = await prisma.documentAssignment.create({
            data: {
              assignmentType: "SINGLE",
              templateId: template.id,
              userId,
              venueId,
              assignedBy: user.id,
              dueDate: dueDateParsed,
              notes,
              status: "PENDING",
              templateVersion: template.currentVersion,
            },
          });
          assignments.push(assignment);
        }
      }
    }

    // Assign bundles
    for (const bundle of bundles) {
      for (const userId of validUserIds) {
        // Check if bundle assignment already exists
        const existing = await prisma.documentAssignment.findFirst({
          where: {
            userId,
            bundleId: bundle.id,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        });

        if (!existing) {
          const assignment = await prisma.documentAssignment.create({
            data: {
              assignmentType: "BUNDLE",
              bundleId: bundle.id,
              userId,
              venueId,
              assignedBy: user.id,
              dueDate: dueDateParsed,
              notes,
              status: "PENDING",
              bundleVersion: bundle.currentVersion,
            },
          });

          // Also create individual assignments for each document in the bundle
          for (const item of bundle.items) {
            await prisma.documentAssignment.create({
              data: {
                assignmentType: "SINGLE",
                templateId: item.templateId,
                userId,
                venueId,
                assignedBy: user.id,
                dueDate: dueDateParsed,
                notes,
                status: "PENDING",
                templateVersion: item.template.currentVersion,
              },
            });
          }

          assignments.push(assignment);
        }
      }
    }

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: venueId,
        action: "ASSIGNED",
        description: `Bulk document assignment: ${assignments.length} assignments created`,
        userId: user.id,
        changes: {
          templateCount: templates.length,
          bundleCount: bundles.length,
          userCount: validUserIds.length,
          dueDate: dueDateParsed,
        },
      },
    });

    return apiSuccess({
      assignments: assignments,
      count: assignments.length,
      skipped: validUserIds.length * (templates.length + bundles.length) - assignments.length,
    });
  } catch (error) {
    console.error("Error creating bulk assignments:", error);
    return apiError("Failed to create assignments");
  }
}
