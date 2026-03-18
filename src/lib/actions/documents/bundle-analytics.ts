"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";

// ============================================================================
// Types
// ============================================================================

export interface BundleAnalyticsData {
  bundleId: string;
  bundleName: string;
  category: string;
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null;
  documents: DocumentAnalytics[];
  userCompliance: UserCompliance[];
  completionTrend: TrendData[];
}

export interface DocumentAnalytics {
  templateId: string;
  templateName: string;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null;
  frequentlyIncomplete: boolean;
}

export interface UserCompliance {
  userId: string;
  userName: string;
  userEmail: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  complianceRate: number;
}

export interface TrendData {
  date: string;
  assigned: number;
  completed: number;
}

export interface VenueAnalyticsSummary {
  totalBundles: number;
  activeBundles: number;
  totalAssignments: number;
  completedAssignments: number;
  overallCompletionRate: number;
  averageCompletionTime: number | null;
  topPerformingBundles: BundleAnalyticsData[];
  strugglingBundles: BundleAnalyticsData[];
  categoryBreakdown: { category: string; count: number; completionRate: number }[];
}

// ============================================================================
// Permission Check Helper
// ============================================================================

async function checkDocumentPermission(
  userId: string,
  action: string,
  venueId?: string
): Promise<boolean> {
  return hasPermission(userId, "documents", action as any, venueId);
}

// ============================================================================
// Analytics Server Actions
// ============================================================================

/**
 * Get analytics for a specific bundle or all bundles in a venue
 */
export async function getBundleAnalytics(
  venueId: string,
  bundleId?: string
): Promise<{ success: boolean; data?: BundleAnalyticsData | VenueAnalyticsSummary; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view analytics" };
    }

    if (bundleId) {
      // Get analytics for specific bundle
      const data = await getSingleBundleAnalytics(bundleId);
      return { success: true, data };
    } else {
      // Get analytics for all bundles in venue
      const data = await getVenueAnalyticsSummary(venueId);
      return { success: true, data };
    }
  } catch (error) {
    console.error("Error fetching bundle analytics:", error);
    return { success: false, error: "Failed to fetch analytics" };
  }
}

/**
 * Get analytics for a single bundle
 */
async function getSingleBundleAnalytics(bundleId: string): Promise<BundleAnalyticsData> {
  const now = new Date();

  // Get bundle with assignments
  const bundle = await prisma.documentBundle.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          template: {
            select: { id: true, name: true },
          },
        },
        orderBy: { order: "asc" },
      },
      assignments: {
        include: {
          assignment: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!bundle) {
    throw new Error("Bundle not found");
  }

  // Get all document assignments for this bundle's templates
  const templateIds = bundle.items.map((item) => item.templateId);
  const documentAssignments = await prisma.documentAssignment.findMany({
    where: {
      templateId: { in: templateIds },
      venueId: bundle.venueId,
    },
    include: {
      template: { select: { id: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  // Calculate bundle-level stats
  const totalAssignments = bundle.assignments.length;
  const completedAssignments = bundle.assignments.filter(
    (a) => a.assignment.status === "COMPLETED"
  ).length;
  const inProgressAssignments = bundle.assignments.filter(
    (a) => a.assignment.status === "IN_PROGRESS"
  ).length;
  const pendingAssignments = bundle.assignments.filter(
    (a) => a.assignment.status === "PENDING"
  ).length;
  const overdueAssignments = bundle.assignments.filter(
    (a) =>
      ["PENDING", "IN_PROGRESS"].includes(a.assignment.status) &&
      a.assignment.dueDate &&
      new Date(a.assignment.dueDate) < now
  ).length;

  const completionRate = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  // Calculate average completion time
  const completedWithTimes = bundle.assignments.filter(
    (a) => a.assignment.status === "COMPLETED" && a.assignment.completedAt
  );
  const averageCompletionTime = completedWithTimes.length > 0
    ? Math.round(
        completedWithTimes.reduce((sum, a) => {
          const assigned = new Date(a.assignment.assignedAt).getTime();
          const completed = new Date(a.assignment.completedAt!).getTime();
          return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
        }, 0) / completedWithTimes.length
      )
    : null;

  // Calculate document-level analytics
  const documents: DocumentAnalytics[] = bundle.items.map((item) => {
    const docAssignments = documentAssignments.filter(
      (da) => da.templateId === item.templateId
    );
    const docCompleted = docAssignments.filter((da) => da.status === "COMPLETED");
    const docCompletionRate = docAssignments.length > 0
      ? Math.round((docCompleted.length / docAssignments.length) * 100)
      : 0;

    // Calculate average completion time for this document
    const completedDocs = docAssignments.filter(
      (da) => da.status === "COMPLETED" && da.completedAt
    );
    const avgTime = completedDocs.length > 0
      ? Math.round(
          completedDocs.reduce((sum, da) => {
            const assigned = new Date(da.assignedAt).getTime();
            const completed = new Date(da.completedAt!).getTime();
            return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
          }, 0) / completedDocs.length
        )
      : null;

    return {
      templateId: item.templateId,
      templateName: item.template.name,
      totalAssignments: docAssignments.length,
      completedAssignments: docCompleted.length,
      completionRate: docCompletionRate,
      averageCompletionTime: avgTime,
      frequentlyIncomplete: docCompletionRate < 50,
    };
  });

  // Calculate user compliance
  const userMap = new Map<string, UserCompliance>();

  for (const ba of bundle.assignments) {
    const userId = ba.userId;
    const userName = ba.assignment.user?.firstName && ba.assignment.user?.lastName
      ? `${ba.assignment.user.firstName} ${ba.assignment.user.lastName}`
      : ba.assignment.user?.email || 'Unknown User';

    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        userName,
        userEmail: ba.assignment.user?.email || 'Unknown Email',
        totalAssigned: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        complianceRate: 0,
      });
    }

    const userStats = userMap.get(userId)!;
    userStats.totalAssigned++;
    if (ba.assignment.status === "COMPLETED") userStats.completed++;
    if (ba.assignment.status === "IN_PROGRESS") userStats.inProgress++;
    if (
      ["PENDING", "IN_PROGRESS"].includes(ba.assignment.status) &&
      ba.assignment.dueDate &&
      new Date(ba.assignment.dueDate) < now
    ) {
      userStats.overdue++;
    }
  }

  // Calculate compliance rates
  const userCompliance = Array.from(userMap.values()).map((u) => ({
    ...u,
    complianceRate: u.totalAssigned > 0
      ? Math.round((u.completed / u.totalAssigned) * 100)
      : 0,
  }));

  // Get completion trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentAssignments = await prisma.documentAssignment.findMany({
    where: {
      bundleId,
      assignedAt: { gte: thirtyDaysAgo },
    },
    select: {
      assignedAt: true,
      completedAt: true,
      status: true,
    },
  });

  // Group by date
  const trendMap = new Map<string, { assigned: number; completed: number }>();
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    trendMap.set(dateStr, { assigned: 0, completed: 0 });
  }

  for (const a of recentAssignments) {
    const assignedDate = new Date(a.assignedAt).toISOString().split("T")[0];
    if (trendMap.has(assignedDate)) {
      trendMap.get(assignedDate)!.assigned++;
    }
    if (a.completedAt) {
      const completedDate = new Date(a.completedAt).toISOString().split("T")[0];
      if (trendMap.has(completedDate)) {
        trendMap.get(completedDate)!.completed++;
      }
    }
  }

  const completionTrend: TrendData[] = Array.from(trendMap.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    bundleId: bundle.id,
    bundleName: bundle.name,
    category: bundle.category,
    totalAssignments,
    completedAssignments,
    inProgressAssignments,
    pendingAssignments,
    overdueAssignments,
    completionRate,
    averageCompletionTime,
    documents,
    userCompliance,
    completionTrend,
  };
}

/**
 * Get analytics summary for all bundles in a venue
 */
async function getVenueAnalyticsSummary(venueId: string): Promise<VenueAnalyticsSummary> {
  // Get all bundles for venue
  const bundles = await prisma.documentBundle.findMany({
    where: { venueId },
    include: {
      _count: {
        select: { assignments: true },
      },
    },
  });

  const activeBundles = bundles.filter((b) => b.isActive).length;

  // Get all assignments for venue
  const assignments = await prisma.documentAssignment.findMany({
    where: { venueId, assignmentType: "BUNDLE" },
    select: {
      id: true,
      status: true,
      assignedAt: true,
      completedAt: true,
      bundleId: true,
    },
  });

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length;
  const overallCompletionRate = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  // Calculate average completion time
  const completedWithTimes = assignments.filter(
    (a) => a.status === "COMPLETED" && a.completedAt
  );
  const averageCompletionTime = completedWithTimes.length > 0
    ? Math.round(
        completedWithTimes.reduce((sum, a) => {
          const assigned = new Date(a.assignedAt).getTime();
          const completed = new Date(a.completedAt!).getTime();
          return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
        }, 0) / completedWithTimes.length
      )
    : null;

  // Get analytics for each bundle
  const bundleAnalytics: BundleAnalyticsData[] = [];
  for (const bundle of bundles) {
    try {
      const analytics = await getSingleBundleAnalytics(bundle.id);
      bundleAnalytics.push(analytics);
    } catch (error) {
      console.error(`Error getting analytics for bundle ${bundle.id}:`, error);
    }
  }

  // Sort by completion rate
  bundleAnalytics.sort((a, b) => b.completionRate - a.completionRate);

  // Top performing (top 5)
  const topPerformingBundles = bundleAnalytics.slice(0, 5);

  // Struggling bundles (completion rate < 70% or has overdue)
  const strugglingBundles = bundleAnalytics
    .filter((b) => b.completionRate < 70 || b.overdueAssignments > 0)
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 5);

  // Category breakdown
  const categoryMap = new Map<string, { count: number; completed: number; total: number }>();
  for (const bundle of bundleAnalytics) {
    if (!categoryMap.has(bundle.category)) {
      categoryMap.set(bundle.category, { count: 0, completed: 0, total: 0 });
    }
    const cat = categoryMap.get(bundle.category)!;
    cat.count++;
    cat.completed += bundle.completedAssignments;
    cat.total += bundle.totalAssignments;
  }

  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
  }));

  return {
    totalBundles: bundles.length,
    activeBundles,
    totalAssignments,
    completedAssignments,
    overallCompletionRate,
    averageCompletionTime,
    topPerformingBundles,
    strugglingBundles,
    categoryBreakdown,
  };
}
