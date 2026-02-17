"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { startOfWeek, endOfWeek } from "date-fns";
import { ReportFilters, FilterValues } from "@/components/reports/ReportFilters";
import { ConflictsList } from "@/components/reports/ConflictsList";
import { ExportButton } from "@/components/reports/ExportButton";
import { getConflictsReport } from "@/lib/actions/reports/availability-reports";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, AlertCircle, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ConflictsReportClientProps {
  venues?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; name: string }>;
}

export function ConflictsReportClient({ venues = [], roles = [] }: ConflictsReportClientProps) {
  const [conflictsData, setConflictsData] = useState<any>(null);
  const [rawConflictsData, setRawConflictsData] = useState<any>(null); // For export
  const [loading, setLoading] = useState(false);
  const [autoGenerateAI, setAutoGenerateAI] = useState(true); // Auto-generate AI resolutions by default
  const [filters, setFilters] = useState<FilterValues>({
    dateRange: {
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    },
    severityLevel: "all",
  });

  // Fetch conflicts data when filters or autoGenerateAI changes
  useEffect(() => {
    const fetchConflicts = async () => {
      if (!filters.dateRange?.from || !filters.dateRange?.to) {
        return;
      }

      setLoading(true);
      try {
        const result = await getConflictsReport({
          startDate: filters.dateRange.from,
          endDate: filters.dateRange.to,
          venueId: filters.venueId,
          severityLevel: filters.severityLevel || "all",
          includeAIResolutions: autoGenerateAI, // Pass the auto-generate flag
        });

        if (result.success) {
          setConflictsData(result.data);
          setRawConflictsData(result.data); // Store for export
          if (autoGenerateAI) {
            toast.success("Conflicts loaded with AI resolutions");
          }
        } else {
          toast.error(result.error || "Failed to load conflicts report");
        }
      } catch (error) {
        toast.error("An error occurred while loading conflicts data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchConflicts();
  }, [filters, autoGenerateAI]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-6">
      {/* AI Auto-Generation Toggle */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="auto-ai"
              checked={autoGenerateAI}
              onCheckedChange={(checked) => setAutoGenerateAI(checked === true)}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-ai" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Auto-generate AI resolutions for critical and warning conflicts
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-7">
            When enabled, AI will automatically suggest resolution strategies for the most serious conflicts
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <ReportFilters
        onApplyFilters={handleApplyFilters}
        showVenue={true}
        showRole={true}
        showTimeSlot={false}
        showSearch={false}
        showSeverity={true}
        venues={venues}
        roles={roles}
      />

      {/* Export Button */}
      {rawConflictsData && (
        <div className="flex justify-end">
          <ExportButton
            reportType="conflicts"
            reportData={rawConflictsData}
            formats={["csv", "excel", "pdf"]}
          />
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Analyzing conflicts...</p>
            </div>
          </CardContent>
        </Card>
      ) : conflictsData ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Conflicts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conflictsData.stats?.total || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Detected issues
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {conflictsData.stats?.critical || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires immediate attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {conflictsData.stats?.warning || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Should be addressed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Info</CardTitle>
                <Info className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {conflictsData.stats?.info || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  For awareness
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Conflict Type Breakdown */}
          {conflictsData.stats?.byType && (
            <Card>
              <CardHeader>
                <CardTitle>Conflict Breakdown</CardTitle>
                <CardDescription>Issues by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium">Understaffing</span>
                    <Badge variant="secondary">
                      {conflictsData.stats.byType.understaffing}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium">No Availability</span>
                    <Badge variant="secondary">
                      {conflictsData.stats.byType.noAvailability}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium">Limited Coverage</span>
                    <Badge variant="secondary">
                      {conflictsData.stats.byType.limitedCoverage}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium">Overlapping Time-Off</span>
                    <Badge variant="secondary">
                      {conflictsData.stats.byType.overlappingTimeOff}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conflicts List */}
          <ConflictsList
            conflicts={conflictsData.conflicts || []}
            title="Detected Conflicts"
            description={`Found ${conflictsData.conflicts?.length || 0} conflicts in the selected period`}
          />
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Select a date range to analyze conflicts
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
