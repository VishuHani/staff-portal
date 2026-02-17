"use client";

/**
 * Column Mapper Component
 * Allows users to customize column mappings for roster extraction
 * Responsive design: Cards on mobile, Table on desktop
 */

import { useState } from "react";
import {
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  type ColumnMapping,
  type ColumnType,
  getColumnTypeLabel,
  formatConfidence,
} from "@/lib/schemas/rosters/extraction";

interface ColumnMapperProps {
  mappings: ColumnMapping[];
  onChange: (mappings: ColumnMapping[]) => void;
  onReset?: () => void;
  className?: string;
}

const COLUMN_TYPES: { value: ColumnType; label: string; required?: boolean }[] = [
  { value: "staff_name", label: "Staff Name", required: true },
  { value: "staff_email", label: "Staff Email" },
  { value: "staff_id", label: "Staff ID" },
  { value: "date", label: "Date", required: true },
  { value: "day_of_week", label: "Day of Week" },
  { value: "start_time", label: "Start Time", required: true },
  { value: "end_time", label: "End Time", required: true },
  { value: "shift_duration", label: "Shift Duration" },
  { value: "position", label: "Position/Role" },
  { value: "venue", label: "Venue" },
  { value: "notes", label: "Notes" },
  { value: "unknown", label: "Ignore Column" },
];

const REQUIRED_FIELDS: ColumnType[] = ["staff_name", "date", "start_time", "end_time"];

export function ColumnMapper({
  mappings,
  onChange,
  onReset,
  className,
}: ColumnMapperProps) {
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(mappings);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const handleMappingChange = (sourceColumn: string, targetField: ColumnType) => {
    const updated = localMappings.map((mapping) =>
      mapping.sourceColumn === sourceColumn
        ? { ...mapping, targetField, confidence: 100 }
        : mapping
    );
    setLocalMappings(updated);
    onChange(updated);
  };

  const handleReset = () => {
    setLocalMappings(mappings);
    onReset?.();
  };

  const toggleCardExpansion = (sourceColumn: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(sourceColumn)) {
        next.delete(sourceColumn);
      } else {
        next.add(sourceColumn);
      }
      return next;
    });
  };

  // Check if all required fields are mapped
  const getMissingRequiredFields = () => {
    const mappedFields = new Set(
      localMappings
        .filter((m) => m.targetField !== "unknown")
        .map((m) => m.targetField)
    );

    return REQUIRED_FIELDS.filter((field) => !mappedFields.has(field));
  };

  const missingFields = getMissingRequiredFields();

  // Check for duplicate mappings (same target field used multiple times)
  const getDuplicateMappings = () => {
    const fieldCounts = new Map<ColumnType, number>();
    for (const mapping of localMappings) {
      if (mapping.targetField !== "unknown") {
        fieldCounts.set(
          mapping.targetField,
          (fieldCounts.get(mapping.targetField) || 0) + 1
        );
      }
    }
    return Array.from(fieldCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([field]) => field);
  };

  const duplicates = getDuplicateMappings();

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (confidence >= 50) {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    return <HelpCircle className="h-4 w-4 text-gray-400" />;
  };

  const getConfidenceBadgeClasses = (confidence: number) => {
    if (confidence >= 80) return "bg-green-50 text-green-700 border-green-200";
    if (confidence >= 50) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  // Mobile Card Component
  const MappingCard = ({ mapping }: { mapping: ColumnMapping }) => {
    const isDuplicate = duplicates.includes(mapping.targetField);
    const isRequired = REQUIRED_FIELDS.includes(mapping.targetField);
    const isExpanded = expandedCards.has(mapping.sourceColumn);

    return (
      <div
        className={cn(
          "rounded-lg border bg-card p-4 space-y-3",
          isDuplicate && "border-yellow-400"
        )}
      >
        {/* Header row with source column */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">
                {mapping.sourceColumn}
              </span>
              {isRequired && (
                <Badge
                  variant="outline"
                  className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0"
                >
                  Required
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {getConfidenceIcon(mapping.confidence)}
            <Badge
              variant="outline"
              className={cn("text-xs", getConfidenceBadgeClasses(mapping.confidence))}
            >
              {formatConfidence(mapping.confidence)}
            </Badge>
          </div>
        </div>

        {/* Mapping selector */}
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={mapping.targetField}
            onValueChange={(value) =>
              handleMappingChange(mapping.sourceColumn, value as ColumnType)
            }
          >
            <SelectTrigger
              className={cn(
                "flex-1",
                isDuplicate && "border-yellow-500"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <span className="flex items-center gap-2">
                    {type.label}
                    {type.required && (
                      <span className="text-xs text-blue-600">*</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sample values (collapsible) */}
        {mapping.sampleValues.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={() => toggleCardExpansion(mapping.sourceColumn)}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span>Sample values ({mapping.sampleValues.length})</span>
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {mapping.sampleValues.map((value, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {value || "(empty)"}
                  </Badge>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  // Desktop Table Row Component
  const TableRowContent = ({ mapping }: { mapping: ColumnMapping }) => {
    const isDuplicate = duplicates.includes(mapping.targetField);
    const isRequired = REQUIRED_FIELDS.includes(mapping.targetField);

    return (
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate max-w-[180px]">{mapping.sourceColumn}</span>
            {isRequired && (
              <Badge
                variant="outline"
                className="text-xs bg-blue-50 text-blue-700 border-blue-200"
              >
                Required
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
        </TableCell>
        <TableCell>
          <Select
            value={mapping.targetField}
            onValueChange={(value) =>
              handleMappingChange(mapping.sourceColumn, value as ColumnType)
            }
          >
            <SelectTrigger
              className={cn(
                "w-full max-w-[200px]",
                isDuplicate && "border-yellow-500"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <span className="flex items-center gap-2">
                    {type.label}
                    {type.required && (
                      <span className="text-xs text-blue-600">*</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  {getConfidenceIcon(mapping.confidence)}
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getConfidenceBadgeClasses(mapping.confidence))}
                  >
                    {formatConfidence(mapping.confidence)}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {mapping.confidence >= 80
                    ? "High confidence in this mapping"
                    : mapping.confidence >= 50
                    ? "Medium confidence - please verify"
                    : "Low confidence - manual verification recommended"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="hidden xl:table-cell">
          <div className="max-w-[250px]">
            {mapping.sampleValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {mapping.sampleValues.slice(0, 3).map((value, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs font-normal truncate max-w-[100px]"
                  >
                    {value || "(empty)"}
                  </Badge>
                ))}
                {mapping.sampleValues.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{mapping.sampleValues.length - 3}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No samples</span>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Validation Messages */}
      {missingFields.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Missing required mappings
              </p>
              <p className="text-xs text-red-700 mt-1">
                Please map columns for:{" "}
                {missingFields.map((f) => getColumnTypeLabel(f)).join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Duplicate mappings detected
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                The following fields are mapped to multiple columns:{" "}
                {duplicates.map((f) => getColumnTypeLabel(f)).join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header with Reset Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium">Column Mappings</h3>
          <p className="text-xs text-muted-foreground">
            Verify or adjust how columns from your file map to roster fields
          </p>
        </div>
        {onReset && (
          <Button variant="outline" size="sm" onClick={handleReset} className="shrink-0">
            <RotateCcw className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>

      {/* Mobile Card Layout (visible on screens < lg) */}
      <div className="lg:hidden space-y-3">
        {localMappings.map((mapping) => (
          <MappingCard key={mapping.sourceColumn} mapping={mapping} />
        ))}
      </div>

      {/* Desktop Table Layout (visible on screens >= lg) */}
      <div className="hidden lg:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Source Column</TableHead>
              <TableHead className="w-[60px] text-center"></TableHead>
              <TableHead className="min-w-[200px]">Maps To</TableHead>
              <TableHead className="min-w-[140px]">Confidence</TableHead>
              <TableHead className="hidden xl:table-cell min-w-[250px]">Sample Values</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localMappings.map((mapping) => (
              <TableRowContent key={mapping.sourceColumn} mapping={mapping} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          <span>High confidence</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-yellow-600" />
          <span>Medium confidence</span>
        </div>
        <div className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3 text-gray-400" />
          <span>Low confidence</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-blue-600">*</span>
          <span>Required field</span>
        </div>
      </div>
    </div>
  );
}
