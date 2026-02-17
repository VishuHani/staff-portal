"use client";

/**
 * Extraction Matrix Preview Component
 * Staff × Days matrix grid view for roster extraction preview
 */

import { useState, useMemo } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  User,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type RosterExtractionResult,
  type ExtractedShift,
  type StaffMatch,
  formatConfidence,
} from "@/lib/schemas/rosters/extraction";
import { format, parseISO, addDays, startOfWeek } from "date-fns";

interface ExtractionMatrixPreviewProps {
  extraction: RosterExtractionResult;
  venueStaff: Array<{ id: string; name: string; email: string }>;
  weekStart: string;
  onStaffMatch: (extractedName: string, userId: string) => void;
  onShiftToggle?: (shiftId: string, included: boolean) => void;
  includedShiftIds?: Set<string>;
  className?: string;
}

interface MatrixRow {
  staffKey: string;
  staffName: string;
  match: StaffMatch | undefined;
  isMatched: boolean;
  shifts: ExtractedShift[];
  shiftsByDay: Map<string, ExtractedShift[]>;
}

interface ShiftCellData {
  day: Date;
  dayStr: string;
  shifts: ExtractedShift[];
}

export function ExtractionMatrixPreview({
  extraction,
  venueStaff,
  weekStart,
  onStaffMatch,
  onShiftToggle,
  includedShiftIds,
  className,
}: ExtractionMatrixPreviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    staffName: string;
    day: string;
    shifts: ExtractedShift[];
  } | null>(null);
  const [localIncludedShifts, setLocalIncludedShifts] = useState<Set<string>>(
    () => includedShiftIds || new Set(extraction.shifts.map((s) => s.id))
  );

  // Generate week days from weekStart
  const weekDays = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  // Create staff match lookup
  const staffMatchLookup = useMemo(() => {
    const lookup = new Map<string, StaffMatch>();
    for (const match of extraction.staffMatches) {
      lookup.set(match.extractedName.toLowerCase(), match);
    }
    return lookup;
  }, [extraction.staffMatches]);

  // Group shifts by staff and then by day
  const matrixData = useMemo(() => {
    const staffMap = new Map<string, MatrixRow>();

    for (const shift of extraction.shifts) {
      const staffKey = shift.staffName?.toLowerCase() || shift.staffEmail?.toLowerCase() || "unknown";
      const staffName = shift.staffName || "Unknown";

      if (!staffMap.has(staffKey)) {
        const match = staffMatchLookup.get(staffKey);
        staffMap.set(staffKey, {
          staffKey,
          staffName,
          match,
          isMatched: !!match?.matchedUserId,
          shifts: [],
          shiftsByDay: new Map(),
        });
      }

      const row = staffMap.get(staffKey)!;
      row.shifts.push(shift);

      // Group by day
      if (shift.date) {
        const dayStr = shift.date.split("T")[0];
        if (!row.shiftsByDay.has(dayStr)) {
          row.shiftsByDay.set(dayStr, []);
        }
        row.shiftsByDay.get(dayStr)!.push(shift);
      }
    }

    return Array.from(staffMap.values());
  }, [extraction.shifts, staffMatchLookup]);

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let rows = [...matrixData];

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((row) => row.staffName.toLowerCase().includes(term));
    }

    // Filter by unmatched only
    if (showUnmatchedOnly) {
      rows = rows.filter((row) => !row.isMatched);
    }

    // Sort: unmatched first, then alphabetically
    rows.sort((a, b) => {
      if (a.isMatched !== b.isMatched) {
        return a.isMatched ? 1 : -1;
      }
      return a.staffName.localeCompare(b.staffName);
    });

    return rows;
  }, [matrixData, searchTerm, showUnmatchedOnly]);

  // Toggle shift inclusion
  const toggleShiftIncluded = (shiftId: string) => {
    const newIncluded = new Set(localIncludedShifts);
    if (newIncluded.has(shiftId)) {
      newIncluded.delete(shiftId);
    } else {
      newIncluded.add(shiftId);
    }
    setLocalIncludedShifts(newIncluded);
    onShiftToggle?.(shiftId, newIncluded.has(shiftId));
  };

  // Get cell status
  const getCellStatus = (shifts: ExtractedShift[]) => {
    if (shifts.length === 0) return "empty";

    const includedCount = shifts.filter((s) => localIncludedShifts.has(s.id)).length;
    const hasIssues = shifts.some((s) => s.issues.length > 0);

    if (includedCount === 0) return "excluded";
    if (includedCount < shifts.length) return "partial";
    if (hasIssues) return "warning";
    return "included";
  };

  // Format shift time for display
  const formatShiftTime = (shift: ExtractedShift) => {
    if (shift.startTime && shift.endTime) {
      return `${shift.startTime}-${shift.endTime}`;
    }
    return "-";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Shifts"
          value={extraction.shifts.length}
          icon={<Calendar className="h-4 w-4" />}
        />
        <SummaryCard
          label="Matched Staff"
          value={extraction.matchedCount}
          total={extraction.staffMatches.length}
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
        />
        <SummaryCard
          label="Unmatched"
          value={extraction.unmatchedCount}
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          variant={extraction.unmatchedCount > 0 ? "warning" : "default"}
        />
        <SummaryCard
          label="Confidence"
          value={`${extraction.confidenceScore}%`}
          icon={
            extraction.overallConfidence === "high" ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : extraction.overallConfidence === "medium" ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <X className="h-4 w-4 text-red-600" />
            )
          }
          variant={
            extraction.overallConfidence === "high"
              ? "success"
              : extraction.overallConfidence === "medium"
              ? "warning"
              : "error"
          }
        />
      </div>

      {/* Warnings */}
      {extraction.warnings.length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-800 text-sm">Warnings</p>
              <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                {extraction.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showUnmatchedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowUnmatchedOnly(!showUnmatchedOnly)}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Unmatched Only ({extraction.unmatchedCount})
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-50" />
          <span>Included</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-yellow-500 bg-yellow-50" />
          <span>Partial/Warning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-gray-300 bg-gray-100" />
          <span>Excluded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-gray-200 bg-gray-50" />
          <span>No shift</span>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Header */}
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {/* Staff Column */}
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r min-w-[180px]"
                >
                  Staff Member
                </th>
                {/* Day Columns */}
                {weekDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    scope="col"
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]"
                  >
                    <div>{format(day, "EEE")}</div>
                    <div className="font-normal text-gray-400">{format(day, "MMM d")}</div>
                  </th>
                ))}
                {/* Status Column */}
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]"
                >
                  Status
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={weekDays.length + 2}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No staff members found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.staffKey}
                    className={cn(
                      "hover:bg-gray-50",
                      !row.isMatched && "bg-yellow-50/50"
                    )}
                  >
                    {/* Staff Name */}
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 border-r whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {row.staffName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {row.shifts.length} shift{row.shifts.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>

                    {/* Day Cells */}
                    {weekDays.map((day) => {
                      const dayStr = format(day, "yyyy-MM-dd");
                      const dayShifts = row.shiftsByDay.get(dayStr) || [];
                      const status = getCellStatus(dayShifts);

                      return (
                        <td key={dayStr} className="px-1 py-1.5 text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (dayShifts.length > 0) {
                                      setSelectedCell({
                                        staffName: row.staffName,
                                        day: dayStr,
                                        shifts: dayShifts,
                                      });
                                    }
                                  }}
                                  className={cn(
                                    "w-full min-h-[48px] p-1 rounded border-2 text-xs transition-colors cursor-pointer",
                                    status === "empty" && "border-gray-200 bg-gray-50 cursor-default",
                                    status === "included" && "border-green-500 bg-green-50 hover:bg-green-100",
                                    status === "partial" && "border-yellow-500 bg-yellow-50 hover:bg-yellow-100",
                                    status === "warning" && "border-orange-500 bg-orange-50 hover:bg-orange-100",
                                    status === "excluded" && "border-gray-300 bg-gray-100 hover:bg-gray-200 opacity-60"
                                  )}
                                >
                                  {dayShifts.length === 0 ? (
                                    <span className="text-gray-400">-</span>
                                  ) : (
                                    <div className="space-y-0.5">
                                      {dayShifts.slice(0, 2).map((shift) => (
                                        <div key={shift.id} className="leading-tight">
                                          <div className="font-medium">
                                            {formatShiftTime(shift)}
                                          </div>
                                          {shift.position && (
                                            <div className="text-[10px] text-gray-500 truncate">
                                              {shift.position}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {dayShifts.length > 2 && (
                                        <div className="text-[10px] text-gray-500">
                                          +{dayShifts.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </button>
                              </TooltipTrigger>
                              {dayShifts.length > 0 && (
                                <TooltipContent side="top">
                                  <div className="space-y-1">
                                    <p className="font-medium">
                                      {format(day, "EEEE, MMMM d")}
                                    </p>
                                    {dayShifts.map((shift) => (
                                      <p key={shift.id} className="text-sm">
                                        {formatShiftTime(shift)}
                                        {shift.position && ` - ${shift.position}`}
                                      </p>
                                    ))}
                                    <p className="text-xs text-gray-400 pt-1">
                                      Click to edit
                                    </p>
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      );
                    })}

                    {/* Status Column */}
                    <td className="px-2 py-2 text-center">
                      {row.isMatched ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Matched
                        </Badge>
                      ) : (
                        <Select
                          onValueChange={(value) => onStaffMatch(row.staffName, value)}
                        >
                          <SelectTrigger className="h-8 text-xs w-full bg-yellow-50 border-yellow-300">
                            <SelectValue placeholder="Match..." />
                          </SelectTrigger>
                          <SelectContent>
                            {venueStaff.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id} className="text-sm">
                                {staff.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRows.length} of {matrixData.length} staff members
      </div>

      {/* Shift Detail Sheet */}
      <Sheet open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          {selectedCell && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedCell.staffName}</SheetTitle>
                <SheetDescription>
                  {format(parseISO(selectedCell.day), "EEEE, MMMM d, yyyy")}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-medium">
                  Shifts ({selectedCell.shifts.length})
                </h4>
                {selectedCell.shifts.map((shift) => {
                  const isIncluded = localIncludedShifts.has(shift.id);
                  return (
                    <div
                      key={shift.id}
                      className={cn(
                        "rounded-lg border p-4 space-y-3",
                        isIncluded ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {shift.startTime} - {shift.endTime}
                          </p>
                          {shift.position && (
                            <p className="text-sm text-muted-foreground">
                              {shift.position}
                            </p>
                          )}
                        </div>
                        <Button
                          variant={isIncluded ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleShiftIncluded(shift.id)}
                        >
                          {isIncluded ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Included
                            </>
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Excluded
                            </>
                          )}
                        </Button>
                      </div>

                      {shift.issues.length > 0 && (
                        <div className="text-xs text-orange-700 bg-orange-50 rounded p-2">
                          <div className="flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <div>
                              {shift.issues.map((issue, idx) => (
                                <p key={idx}>{issue}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {shift.notes && (
                        <p className="text-xs text-muted-foreground">
                          Notes: {shift.notes}
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedCell(null)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  label,
  value,
  total,
  icon,
  variant = "default",
}: {
  label: string;
  value: number | string;
  total?: number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error";
}) {
  const variantClasses = {
    default: "bg-card border",
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
  };

  return (
    <div className={cn("rounded-lg p-3 border", variantClasses[variant])}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-muted-foreground">/{total}</span>
        )}
      </p>
    </div>
  );
}
