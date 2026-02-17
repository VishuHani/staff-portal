import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CompareVersionsClient } from "./compare-client";
import { getRosterById } from "@/lib/actions/rosters";
import { compareVersions, type VersionDiff } from "@/lib/services/version-chain";

export const metadata = {
  title: "Compare Roster Versions | Team Management",
  description: "Compare differences between roster versions",
};

interface ComparePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ with?: string }>;
}

export default async function ComparePage({ params, searchParams }: ComparePageProps) {
  const { id } = await params;
  const { with: compareWithId } = await searchParams;
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("rosters", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Fetch the source roster
  const sourceResult = await getRosterById(id);
  if (!sourceResult.success || !sourceResult.roster) {
    notFound();
  }

  const sourceRoster = sourceResult.roster;

  // If no comparison target specified, show selection
  if (!compareWithId) {
    return (
      <DashboardLayout user={user}>
        <CompareVersionsClient
          sourceRoster={{
            id: sourceRoster.id,
            name: sourceRoster.name,
            versionNumber: sourceRoster.versionNumber,
            chainId: sourceRoster.chainId,
          }}
          targetRoster={null}
          comparison={null}
        />
      </DashboardLayout>
    );
  }

  // Fetch the target roster
  const targetResult = await getRosterById(compareWithId);
  if (!targetResult.success || !targetResult.roster) {
    notFound();
  }

  const targetRoster = targetResult.roster;

  // Get comparison data
  const comparisonResult = await compareVersions(id, compareWithId);

  return (
    <DashboardLayout user={user}>
      <CompareVersionsClient
        sourceRoster={{
          id: sourceRoster.id,
          name: sourceRoster.name,
          versionNumber: sourceRoster.versionNumber,
          chainId: sourceRoster.chainId,
        }}
        targetRoster={{
          id: targetRoster.id,
          name: targetRoster.name,
          versionNumber: targetRoster.versionNumber,
          chainId: targetRoster.chainId,
        }}
        comparison={comparisonResult.success ? (comparisonResult.diff as VersionDiff) : null}
      />
    </DashboardLayout>
  );
}
