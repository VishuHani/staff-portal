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
}

export function CoverageAnalysisClient({ venues = [] }: CoverageAnalysisClientProps) {
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
          setCoverageData(result.data);
          setRawCoverageData(result.data); // Store for export
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
