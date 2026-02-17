"use client";

/**
 * Extraction Preview Component
 * Shows extracted roster data with confidence indicators and validation
 */

import { useState, useMemo } from "react";
import {
  Check,
  X,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  UserPlus,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  type RosterExtractionResult,
  type ExtractedShift,
  type StaffMatch,
  getConfidenceColor,
  formatConfidence,
} from "@/lib/schemas/rosters/extraction";
import { format, parseISO } from "date-fns";

interface ExtractionPreviewProps {
  extraction: RosterExtractionResult;
  venueStaff: Array<{ id: string; name: string; email: string }>;
  onStaffMatch: (extractedName: string, userId: string) => void;
  onShiftToggle?: (shiftId: string, included: boolean) => void;
  className?: string;
}

export function ExtractionPreview({
  extraction,
  venueStaff,
  onStaffMatch,
  onShiftToggle,
  className,
}: ExtractionPreviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [includedShifts, setIncludedShifts] = useState<Set<string>>(
    new Set(extraction.shifts.map((s) => s.id))
  );

  // Group shifts by staff member
  const shiftsByStaff = useMemo(() => {
    const grouped = new Map<string, ExtractedShift[]>();

    for (const shift of extraction.shifts) {
      const key = shift.staffName?.toLowerCase() || shift.staffEmail?.toLowerCase() || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(shift);
    }

    return grouped;
  }, [extraction.shifts]);

  // Create staff match lookup
  const staffMatchLookup = useMemo(() => {
    const lookup = new Map<string, StaffMatch>();
    for (const match of extraction.staffMatches) {
      lookup.set(match.extractedName.toLowerCase(), match);
    }
    return lookup;
  }, [extraction.staffMatches]);

  // Filter staff based on search and filter settings
  const filteredStaff = useMemo(() => {
    let staffList = Array.from(shiftsByStaff.keys());

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      staffList = staffList.filter((key) => {
        const shifts = shiftsByStaff.get(key) || [];
        const staffName = shifts[0]?.staffName || "";
        return staffName.toLowerCase().includes(term);
      });
    }

    if (showUnmatchedOnly) {
      staffList = staffList.filter((key) => {
        const match = staffMatchLookup.get(key);
        return !match?.matchedUserId;
      });
    }

    return staffList;
  }, [shiftsByStaff, staffMatchLookup, searchTerm, showUnmatchedOnly]);

  const toggleStaffExpand = (staffKey: string) => {
    const newExpanded = new Set(expandedStaff);
    if (newExpanded.has(staffKey)) {
      newExpanded.delete(staffKey);
    } else {
      newExpanded.add(staffKey);
    }
    setExpandedStaff(newExpanded);
  };

  const toggleShiftIncluded = (shiftId: string) => {
    const newIncluded = new Set(includedShifts);
    if (newIncluded.has(shiftId)) {
      newIncluded.delete(shiftId);
    } else {
      newIncluded.add(shiftId);
    }
    setIncludedShifts(newIncluded);
    onShiftToggle?.(shiftId, newIncluded.has(shiftId));
  };

  const getMatchStatusIcon = (match: StaffMatch | undefined) => {
    if (!match) return <HelpCircle className="h-4 w-4 text-gray-400" />;

    switch (match.matchType) {
      case "exact_email":
      case "exact_name":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "fuzzy_name":
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "none":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getMatchStatusText = (match: StaffMatch | undefined) => {
    if (!match) return "Unknown";

    switch (match.matchType) {
      case "exact_email":
        return `Matched by email: ${match.matchedUserEmail}`;
      case "exact_name":
        return `Matched: ${match.matchedUserName}`;
      case "fuzzy_name":
        return `Possible match: ${match.matchedUserName} (${formatConfidence(match.confidence)})`;
      case "partial":
        return `Partial match: ${match.matchedUserName} (${formatConfidence(match.confidence)})`;
      case "none":
        return "No match found";
    }
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

      {/* Filters */}
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
          <UserPlus className="h-4 w-4 mr-2" />
          Unmatched Only ({extraction.unmatchedCount})
        </Button>
      </div>

      {/* Staff List */}
      <ScrollArea className="h-[400px] rounded-md border">
        <div className="p-4 space-y-3">
          {filteredStaff.map((staffKey) => {
            const shifts = shiftsByStaff.get(staffKey) || [];
            const firstShift = shifts[0];
            const staffName = firstShift?.staffName || "Unknown";
            const match = staffMatchLookup.get(staffKey);
            const isExpanded = expandedStaff.has(staffKey);

            return (
              <Collapsible
                key={staffKey}
                open={isExpanded}
                onOpenChange={() => toggleStaffExpand(staffKey)}
              >
                <div className="rounded-lg border bg-card">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {getMatchStatusIcon(match)}
                        <div>
                          <p className="font-medium">{staffName}</p>
                          <p className="text-xs text-muted-foreground">
                            {getMatchStatusText(match)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">
                          {shifts.length} shift{shifts.length !== 1 ? "s" : ""}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t p-4 space-y-4">
                      {/* Manual Match Section */}
                      {!match?.matchedUserId && (
                        <div className="flex items-center gap-3 pb-3 border-b">
                          <Label className="text-sm whitespace-nowrap">Match to:</Label>
                          <Select
                            onValueChange={(value) => onStaffMatch(staffName, value)}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue placeholder="Select staff member..." />
                            </SelectTrigger>
                            <SelectContent>
                              {venueStaff.map((staff) => (
                                <SelectItem key={staff.id} value={staff.id}>
                                  {staff.name} ({staff.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Shifts Table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">Include</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shifts.map((shift) => (
                            <TableRow key={shift.id}>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleShiftIncluded(shift.id)}
                                >
                                  {includedShifts.has(shift.id) ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <X className="h-4 w-4 text-gray-400" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell>
                                {shift.date
                                  ? format(parseISO(shift.date), "EEE, MMM d")
                                  : shift.dayOfWeek || "-"}
                              </TableCell>
                              <TableCell>
                                {shift.startTime && shift.endTime
                                  ? `${shift.startTime} - ${shift.endTime}`
                                  : "-"}
                              </TableCell>
                              <TableCell>{shift.position || "-"}</TableCell>
                              <TableCell>
                                {shift.issues.length > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-yellow-50 text-yellow-700 border-yellow-200"
                                  >
                                    {shift.issues.length} issue{shift.issues.length > 1 ? "s" : ""}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 border-green-200"
                                  >
                                    Valid
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Show issues if any */}
                      {shifts.some((s) => s.issues.length > 0) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {shifts
                            .flatMap((s) => s.issues.map((issue) => ({ shiftId: s.id, issue })))
                            .slice(0, 5)
                            .map((item, idx) => (
                              <p key={idx} className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                {item.issue}
                              </p>
                            ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {filteredStaff.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No staff members found</p>
            </div>
          )}
        </div>
      </ScrollArea>
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
