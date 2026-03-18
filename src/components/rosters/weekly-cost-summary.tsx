"use client";

/**
 * Weekly Cost Summary Component
 * Displays a breakdown of weekly wages including gross pay, superannuation, and total cost
 * Only visible to users with pay rate viewing permissions (ADMIN/MANAGER)
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DollarSign,
  Clock,
  TrendingUp,
  PiggyBank,
  Calculator,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatHours,
  calculateWeeklyPaySummary,
  getEffectiveSuperConfig,
  type ShiftPayInput,
  type StaffPayRates,
  type VenuePayConfig,
  type SuperConfig,
} from "@/lib/utils/pay-calculator";
import { Decimal } from "@prisma/client/runtime/library";

interface Shift {
  id: string;
  userId: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    superEnabled: boolean | null;
    customSuperRate: Decimal | number | null;
  } | null;
}

interface WeeklyCostSummaryProps {
  shifts: Shift[];
  staffPayRates: Record<string, StaffPayRates>;
  venuePayConfig: VenuePayConfig | null;
  className?: string;
}

// Helper to convert Decimal to number
function toNumber(value: Decimal | number | null | unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as Decimal).toNumber();
  }
  return null;
}

export function WeeklyCostSummary({
  shifts,
  staffPayRates,
  venuePayConfig,
  className,
}: WeeklyCostSummaryProps) {
  // Calculate weekly pay summary with superannuation
  const summary = useMemo(() => {
    // Filter shifts with valid timing and assigned users
    const validShifts = shifts.filter(
      (s) =>
        s.userId &&
        s.startTime &&
        s.endTime &&
        s.startTime !== "-" &&
        s.endTime !== "-" &&
        s.startTime.includes(":") &&
        s.endTime.includes(":")
    );

    if (validShifts.length === 0) {
      return null;
    }

    // Build staff super configs
    const staffSuperConfigs: Record<string, SuperConfig> = {};
    for (const shift of validShifts) {
      if (shift.userId && !staffSuperConfigs[shift.userId]) {
        const userSuperEnabled = shift.user?.superEnabled ?? null;
        const userSuperRate = shift.user?.customSuperRate ?? null;
        const venueSuperEnabled = venuePayConfig?.superEnabled ?? true;
        const venueSuperRate = venuePayConfig?.superRate ?? null;

        staffSuperConfigs[shift.userId] = getEffectiveSuperConfig(
          userSuperEnabled,
          userSuperRate,
          venueSuperEnabled,
          venueSuperRate
        );
      }
    }

    // Prepare shifts for calculation
    const shiftsForCalc = validShifts.map((s) => ({
      date: new Date(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes,
      userId: s.userId!,
      shiftId: s.id,
    }));

    // Calculate weekly summary
    return calculateWeeklyPaySummary(
      shiftsForCalc,
      staffPayRates,
      staffSuperConfigs,
      venuePayConfig
    );
  }, [shifts, staffPayRates, venuePayConfig]);

  if (!summary) {
    return null;
  }

  const superRatePercent = (summary.superRate * 100).toFixed(1);

  return (
    <TooltipProvider>
      <Card className={cn("shadow-sm", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            Weekly Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Hours */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Total Hours</span>
              </div>
              <div className="text-2xl font-bold">{formatHours(summary.totalHours)}</div>
            </div>

            {/* Gross Pay (Wages) */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Gross Pay</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.grossPay)}
              </div>
              {summary.overtimePay > 0 && (
                <div className="text-xs text-muted-foreground">
                  incl. {formatCurrency(summary.overtimePay)} OT
                </div>
              )}
            </div>

            {/* Superannuation */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Super</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Superannuation at {superRatePercent}%</p>
                    <p className="text-xs text-muted-foreground">
                      Rate based on venue default or individual staff settings
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.superPay)}
              </div>
              <Badge variant="secondary" className="text-xs">
                {superRatePercent}%
              </Badge>
            </div>

            {/* Total Cost */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Total Cost</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(summary.totalCost)}
              </div>
              <div className="text-xs text-muted-foreground">
                Wages + Super
              </div>
            </div>
          </div>

          {/* Breakdown by Staff */}
          {summary.staffBreakdown.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Staff Breakdown</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {summary.staffBreakdown
                  .sort((a, b) => b.totalCost - a.totalCost)
                  .map((staff) => (
                    <div
                      key={staff.staffId}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{staff.staffName || "Unknown"}</span>
                        <span className="text-muted-foreground">
                          {formatHours(staff.totalHours)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold text-emerald-600">
                            {formatCurrency(staff.grossPay)}
                          </div>
                          {staff.superEnabled && staff.superPay > 0 && (
                            <div className="text-xs text-blue-600">
                              +{formatCurrency(staff.superPay)} super
                            </div>
                          )}
                        </div>
                        <div className="text-right min-w-[70px]">
                          <div className="font-bold text-primary">
                            {formatCurrency(staff.totalCost)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Daily Breakdown Toggle */}
          {summary.dailyBreakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Daily Breakdown</h4>
              <div className="grid grid-cols-7 gap-1">
                {summary.dailyBreakdown
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((day) => (
                    <Tooltip key={day.dateKey}>
                      <TooltipTrigger asChild>
                        <div className="text-center p-2 rounded bg-muted/50 hover:bg-muted cursor-default">
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            {new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}
                          </div>
                          <div className="text-sm font-semibold">
                            {formatHours(day.totalHours)}
                          </div>
                          <div className="text-xs text-emerald-600">
                            {formatCurrency(day.grossPay)}
                          </div>
                          {day.superPay > 0 && (
                            <div className="text-xs text-blue-600">
                              +{formatCurrency(day.superPay)}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">
                            {new Date(day.date).toLocaleDateString("en-AU", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p>{day.shiftCount} shifts • {formatHours(day.totalHours)}</p>
                          <div className="border-t pt-1 mt-1">
                            <p>Gross: {formatCurrency(day.grossPay)}</p>
                            {day.superPay > 0 && <p>Super: {formatCurrency(day.superPay)}</p>}
                            <p className="font-semibold">Total: {formatCurrency(day.totalCost)}</p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
