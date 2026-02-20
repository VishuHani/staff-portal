"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { startOfWeek, endOfWeek } from "date-fns";
import { ReportFilters, FilterValues } from "@/components/reports/ReportFilters";
import { ReportSummaryCards, coverageStatsToCards } from "@/components/reports/ReportSummaryCards";
import { CoverageChart } from "@/components/reports/CoverageChart";
import { CoverageHeatmap } from "@/components/reports/CoverageHeatmap";
import { ExportButton } from "@/components/reports/ExportButton";
import { getCoverageAnalysis } from "@/lib/actions/reports/availability-reports";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CoverageAnalysisClientProps {
  venues?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; name: string }>;
}

// Day mapping for heatmap transformation
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Transform server data to match component expectations
function transformCoverageData(serverData: any) {
  // Transform heatmap from object to array
  const heatmapArray: Array<{ day: string; hour: number; count: number }> = [];

  if (serverData.heatmap && typeof serverData.heatmap === 'object') {
    for (const [dow, hours] of Object.entries(serverData.heatmap)) {
      const dayOfWeek = parseInt(dow);
      const dayName = DAY_NAMES[dayOfWeek];

      if (hours && typeof hours === 'object') {
        for (const [timeSlot, count] of Object.entries(hours)) {
          // Extract hour from "HH:00" format
          const hour = parseInt(timeSlot.split(':')[0]);
          heatmapArray.push({
            day: dayName,
            hour,
            count: count as number
          });
        }
      }
    }
  }

  // Transform dailyCoverage to map 'percentage' to 'coveragePercentage'
  // Server returns 'percentage' but CoverageChart expects 'coveragePercentage'
  const dailyCoverage = (serverData.dailyCoverage || []).map((day: any) => ({
    date: day.date,
    availableStaff: day.availableStaff,
    totalStaff: day.totalStaff,
    coveragePercentage: day.percentage ?? 0, // Map 'percentage' to 'coveragePercentage'
    requiredStaff: day.requiredStaff,
    status: day.status,
  }));

  // Transform summary to stats with correct field names
  return {
    stats: {
      totalStaff: serverData.summary?.totalStaff || 0,
      availableStaff: serverData.summary?.averageAvailability || 0, // Use average as "currently available"
      averageCoverage: serverData.summary?.averageAvailability || 0,
      peakCoverage: serverData.summary?.peakAvailability?.count || 0,
    },
    dailyCoverage,
    heatmap: heatmapArray,
  };
}

export function CoverageAnalysisClient({ venues = [], roles = [] }: CoverageAnalysisClientProps) {
  const [coverageData, setCoverageData] = useState<any>(null);
  const [rawCoverageData, setRawCoverageData] = useState<any>(null); // For export
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    dateRange: {
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    },
  });

  // Fetch coverage data when filters change
  useEffect(() => {
    const fetchCoverage = async () => {
      if (!filters.dateRange?.from || !filters.dateRange?.to) {
        return;
      }

      setLoading(true);
      try {
        const result = await getCoverageAnalysis({
          startDate: filters.dateRange.from,
          endDate: filters.dateRange.to,
          venueId: filters.venueId,
        });

        if (result.success) {
          console.log('[Coverage] Raw server data:', result.data);

          // Transform server data to match component expectations
          const transformed = transformCoverageData(result.data);
          console.log('[Coverage] Transformed data:', transformed);

          setCoverageData(transformed);
          setRawCoverageData(result.data); // Store original for export
        } else {
          toast.error(result.error || "Failed to load coverage analysis");
        }
      } catch (error) {
        toast.error("An error occurred while loading coverage data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoverage();
  }, [filters]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ReportFilters
        onApplyFilters={handleApplyFilters}
        showVenue={true}
        showRole={true}
        showTimeSlot={false}
        showSearch={false}
        venues={venues}
        roles={roles}
      />

      {/* Export Button */}
      {rawCoverageData && (
        <div className="flex justify-end">
          <ExportButton
            reportType="coverage"
            reportData={rawCoverageData}
            formats={["csv", "excel", "pdf"]}
          />
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading coverage analysis...</p>
            </div>
          </CardContent>
        </Card>
      ) : coverageData ? (
        <>
          {/* Summary Cards */}
          <ReportSummaryCards
            cards={coverageStatsToCards({
              totalStaff: coverageData.stats?.totalStaff || 0,
              availableStaff: coverageData.stats?.availableStaff || 0,
              averageCoverage: coverageData.stats?.averageCoverage || 0,
              peakCoverage: coverageData.stats?.peakCoverage || 0,
            })}
          />

          {/* Daily Coverage Chart */}
          <CoverageChart
            data={coverageData.dailyCoverage || []}
            title="Daily Coverage Levels"
            description="Number of available staff per day"
          />

          {/* Coverage Heatmap */}
          <CoverageHeatmap
            data={coverageData.heatmap || []}
            title="Coverage Heatmap"
            description="Staff availability by day and hour"
          />
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Select a date range to view coverage analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
