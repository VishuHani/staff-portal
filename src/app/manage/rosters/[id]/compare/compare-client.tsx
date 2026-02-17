"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  ArrowLeft,
  GitCompare,
  Plus,
  Minus,
  Edit,
  ArrowRight,
  Loader2,
  GitBranch,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { getRosterVersionChain } from "@/lib/actions/rosters";
import type { VersionDiff, ShiftSnapshot } from "@/lib/services/version-chain";
import { cn } from "@/lib/utils";

interface RosterInfo {
  id: string;
  name: string;
  versionNumber: number;
  chainId: string | null;
}

interface CompareVersionsClientProps {
  sourceRoster: RosterInfo;
  targetRoster: RosterInfo | null;
  comparison: VersionDiff | null;
}

interface VersionOption {
  id: string;
  name: string;
  versionNumber: number;
  status: string;
  createdAt: Date;
}

export function CompareVersionsClient({
  sourceRoster,
  targetRoster,
  comparison,
}: CompareVersionsClientProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>(targetRoster?.id || "");

  useEffect(() => {
    if (sourceRoster.chainId) {
      loadVersions();
    }
  }, [sourceRoster.chainId]);

  async function loadVersions() {
    try {
      setLoading(true);
      const result = await getRosterVersionChain(sourceRoster.id);
      if (result.success && result.versions) {
        setVersions(
          result.versions
            .filter((v: VersionOption) => v.id !== sourceRoster.id)
            .map((v: VersionOption) => ({
              id: v.id,
              name: v.name,
              versionNumber: v.versionNumber,
              status: v.status,
              createdAt: v.createdAt,
            }))
        );
      }
    } catch (error) {
      console.error("Error loading versions:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleCompare() {
    if (selectedTarget) {
      router.push(`/manage/rosters/${sourceRoster.id}/compare?with=${selectedTarget}`);
    }
  }

  // No chain - can't compare
  if (!sourceRoster.chainId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/manage/rosters/${sourceRoster.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Compare Versions</h1>
            <p className="text-muted-foreground">{sourceRoster.name}</p>
          </div>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No Versions to Compare</p>
            <p className="text-muted-foreground mt-2">
              This roster is not part of a version chain. Create a new version first to enable comparison.
            </p>
            <Link href={`/manage/rosters/${sourceRoster.id}`}>
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Roster
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No target selected - show version picker
  if (!targetRoster) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/manage/rosters/${sourceRoster.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Compare Versions</h1>
            <p className="text-muted-foreground">{sourceRoster.name}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Select Version to Compare
            </CardTitle>
            <CardDescription>
              Choose another version from the chain to compare with Version {sourceRoster.versionNumber}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No other versions available to compare.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Compare with:</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a version" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            <span className="flex items-center gap-2">
                              <GitBranch className="h-4 w-4" />
                              v{v.versionNumber} - {v.name}
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {v.status}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCompare}
                    disabled={!selectedTarget}
                    className="mt-6"
                  >
                    Compare
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show comparison results
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/manage/rosters/${sourceRoster.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Version Comparison</h1>
            <p className="text-muted-foreground">
              Comparing v{sourceRoster.versionNumber} with v{targetRoster.versionNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg py-1 px-3">
            v{sourceRoster.versionNumber}
          </Badge>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <Badge variant="outline" className="text-lg py-1 px-3">
            v{targetRoster.versionNumber}
          </Badge>
        </div>
      </div>

      {/* Summary */}
      {comparison && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{comparison.summary.totalChanges}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Added</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                +{comparison.summary.addedCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Removed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                -{comparison.summary.removedCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">Modified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {comparison.summary.modifiedCount}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Added Shifts */}
      {comparison && comparison.added.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Plus className="h-5 w-5" />
              Added Shifts ({comparison.added.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparison.added.map((shift, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <p className="font-medium">{shift.userName || "Unassigned"}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(shift.date), "EEE, MMM d")}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <p>
                      {shift.startTime} - {shift.endTime}
                    </p>
                    {shift.position && (
                      <Badge variant="secondary">{shift.position}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Removed Shifts */}
      {comparison && comparison.removed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Minus className="h-5 w-5" />
              Removed Shifts ({comparison.removed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparison.removed.map((shift, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <p className="font-medium">{shift.userName || "Unassigned"}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(shift.date), "EEE, MMM d")}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <p>
                      {shift.startTime} - {shift.endTime}
                    </p>
                    {shift.position && (
                      <Badge variant="secondary">{shift.position}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modified Shifts */}
      {comparison && comparison.modified.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Edit className="h-5 w-5" />
              Modified Shifts ({comparison.modified.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comparison.modified.map((mod, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium">
                      {mod.before.userName || mod.after.userName || "Unassigned"} -{" "}
                      {format(new Date(mod.before.date), "EEE, MMM d")}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {mod.changes.map((change, i) => (
                      <p key={i} className="text-sm text-amber-800">
                        • {change}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reassigned Shifts */}
      {comparison && comparison.reassigned && comparison.reassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <UserCheck className="h-5 w-5" />
              Reassigned Shifts ({comparison.reassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparison.reassigned.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <p className="text-muted-foreground">
                        {format(new Date(item.shift.date), "EEE, MMM d")} - {item.shift.startTime} to {item.shift.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <p className="text-purple-800">
                      {item.previousUser || "Unassigned"} → {item.newUser || "Unassigned"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Changes */}
      {comparison && comparison.summary.totalChanges === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No Differences Found</p>
            <p className="text-muted-foreground mt-2">
              These two versions have identical shift data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
