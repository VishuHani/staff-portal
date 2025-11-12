"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, startOfDay, endOfDay } from "date-fns";
import { DateRangePicker } from "./DateRangePicker";
import { MultiSelect, Option } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, X, Calendar, Clock, Bookmark } from "lucide-react";

interface ReportFiltersProps {
  onApplyFilters: (filters: FilterValues) => void;
  showVenue?: boolean;
  showRole?: boolean;
  showTimeSlot?: boolean;
  showSearch?: boolean;
  showSeverity?: boolean;
  venues?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; name: string }>;
}

export interface FilterValues {
  dateRange?: DateRange;
  venueId?: string; // Keep for backward compatibility
  venueIds?: string[]; // New: multi-select
  roleId?: string; // Keep for backward compatibility
  roleIds?: string[]; // New: multi-select
  timeSlotStart?: string;
  timeSlotEnd?: string;
  searchQuery?: string;
  severityLevel?: "all" | "critical" | "warning" | "info";
}

const FILTER_STORAGE_KEY = "reportFilters";

export function ReportFilters({
  onApplyFilters,
  showVenue = true,
  showRole = true,
  showTimeSlot = false,
  showSearch = true,
  showSeverity = false,
  venues = [],
  roles = [],
}: ReportFiltersProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [venueIds, setVenueIds] = useState<string[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [timeSlotStart, setTimeSlotStart] = useState<string>("");
  const [timeSlotEnd, setTimeSlotEnd] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [severityLevel, setSeverityLevel] = useState<string>("all");

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        const filters = JSON.parse(saved);
        if (filters.venueIds) setVenueIds(filters.venueIds);
        if (filters.roleIds) setRoleIds(filters.roleIds);
        if (filters.searchQuery) setSearchQuery(filters.searchQuery);
        if (filters.severityLevel) setSeverityLevel(filters.severityLevel);
        if (filters.timeSlotStart) setTimeSlotStart(filters.timeSlotStart);
        if (filters.timeSlotEnd) setTimeSlotEnd(filters.timeSlotEnd);
      }
    } catch (error) {
      console.error("Failed to load saved filters:", error);
    }
  }, []);

  const handleApply = () => {
    const filters: FilterValues = {};

    if (dateRange) {
      filters.dateRange = dateRange;
    }
    if (venueIds.length > 0) {
      filters.venueIds = venueIds;
      // Backward compatibility: set venueId to first selection
      filters.venueId = venueIds[0];
    }
    if (roleIds.length > 0) {
      filters.roleIds = roleIds;
      // Backward compatibility: set roleId to first selection
      filters.roleId = roleIds[0];
    }
    if (timeSlotStart) {
      filters.timeSlotStart = timeSlotStart;
    }
    if (timeSlotEnd) {
      filters.timeSlotEnd = timeSlotEnd;
    }
    if (searchQuery) {
      filters.searchQuery = searchQuery;
    }
    if (severityLevel && severityLevel !== "all") {
      filters.severityLevel = severityLevel as "all" | "critical" | "warning" | "info";
    }

    // Save to localStorage (excluding dateRange as it's often dynamic)
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        venueIds,
        roleIds,
        searchQuery,
        severityLevel,
        timeSlotStart,
        timeSlotEnd,
      }));
    } catch (error) {
      console.error("Failed to save filters:", error);
    }

    onApplyFilters(filters);
  };

  const handleClear = () => {
    setDateRange(undefined);
    setVenueIds([]);
    setRoleIds([]);
    setTimeSlotStart("");
    setTimeSlotEnd("");
    setSearchQuery("");
    setSeverityLevel("all");

    // Clear localStorage
    try {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear saved filters:", error);
    }

    onApplyFilters({});
  };

  const hasFilters =
    dateRange || venueIds.length > 0 || roleIds.length > 0 || timeSlotStart || timeSlotEnd || searchQuery || (severityLevel && severityLevel !== "all");

  // Quick filter buttons
  const quickFilters = [
    {
      label: "Today",
      icon: Calendar,
      action: () => {
        const today = new Date();
        setDateRange({ from: startOfDay(today), to: endOfDay(today) });
      },
    },
    {
      label: "This Week",
      icon: Calendar,
      action: () => {
        const now = new Date();
        setDateRange({
          from: startOfWeek(now, { weekStartsOn: 1 }),
          to: endOfWeek(now, { weekStartsOn: 1 }),
        });
      },
    },
    {
      label: "Next Week",
      icon: Calendar,
      action: () => {
        const nextWeek = addDays(new Date(), 7);
        setDateRange({
          from: startOfWeek(nextWeek, { weekStartsOn: 1 }),
          to: endOfWeek(nextWeek, { weekStartsOn: 1 }),
        });
      },
    },
    {
      label: "This Month",
      icon: Calendar,
      action: () => {
        const now = new Date();
        setDateRange({
          from: startOfMonth(now),
          to: endOfMonth(now),
        });
      },
    },
  ];

  // Convert venues and roles to Option format for MultiSelect
  const venueOptions: Option[] = venues.map((v) => ({
    label: v.name,
    value: v.id,
  }));

  const roleOptions: Option[] = roles.map((r) => ({
    label: r.name,
    value: r.id,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Filters */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quick Date Filters</Label>
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <Button
                key={filter.label}
                variant="outline"
                size="sm"
                onClick={filter.action}
                className="h-8 text-xs"
              >
                <filter.icon className="h-3 w-3 mr-1" />
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Search */}
        {showSearch && (
          <div className="space-y-2">
            <Label htmlFor="search">Search Staff</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {/* Venue Multi-Select */}
        {showVenue && venues.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="venue">
              Venues {venueIds.length > 0 && <span className="text-muted-foreground text-xs">({venueIds.length} selected)</span>}
            </Label>
            <MultiSelect
              options={venueOptions}
              selected={venueIds}
              onChange={setVenueIds}
              placeholder="Select venues..."
            />
          </div>
        )}

        {/* Role Multi-Select */}
        {showRole && roles.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="role">
              Roles {roleIds.length > 0 && <span className="text-muted-foreground text-xs">({roleIds.length} selected)</span>}
            </Label>
            <MultiSelect
              options={roleOptions}
              selected={roleIds}
              onChange={setRoleIds}
              placeholder="Select roles..."
            />
          </div>
        )}

        {/* Time Slot */}
        {showTimeSlot && (
          <div className="space-y-2">
            <Label>Time Slot Filter</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="time-start" className="text-xs text-muted-foreground">
                  Start Time
                </Label>
                <Input
                  id="time-start"
                  type="time"
                  value={timeSlotStart}
                  onChange={(e) => setTimeSlotStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="time-end" className="text-xs text-muted-foreground">
                  End Time
                </Label>
                <Input
                  id="time-end"
                  type="time"
                  value={timeSlotEnd}
                  onChange={(e) => setTimeSlotEnd(e.target.value)}
                />
              </div>
            </div>
            {timeSlotStart && timeSlotEnd && (
              <p className="text-xs text-muted-foreground">
                Show staff available between {timeSlotStart} - {timeSlotEnd}
              </p>
            )}
          </div>
        )}

        {/* Severity Level */}
        {showSeverity && (
          <div className="space-y-2">
            <Label htmlFor="severity">Severity Level</Label>
            <Select value={severityLevel} onValueChange={setSeverityLevel}>
              <SelectTrigger id="severity">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="warning">Warning Only</SelectItem>
                <SelectItem value="info">Info Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
          {hasFilters && (
            <Button onClick={handleClear} variant="outline" size="icon">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {hasFilters && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Active Filters</Label>
            <div className="flex flex-wrap gap-2">
              {venueIds.length > 0 && venueIds.map((venueId) => {
                const venue = venues.find((v) => v.id === venueId);
                return (
                  <Badge key={venueId} variant="secondary" className="pr-1">
                    {venue?.name}
                    <button
                      onClick={() => setVenueIds(venueIds.filter((id) => id !== venueId))}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {roleIds.length > 0 && roleIds.map((roleId) => {
                const role = roles.find((r) => r.id === roleId);
                return (
                  <Badge key={roleId} variant="secondary" className="pr-1">
                    {role?.name}
                    <button
                      onClick={() => setRoleIds(roleIds.filter((id) => id !== roleId))}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {searchQuery && (
                <Badge variant="secondary" className="pr-1">
                  Search: {searchQuery}
                  <button
                    onClick={() => setSearchQuery("")}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {timeSlotStart && timeSlotEnd && (
                <Badge variant="secondary" className="pr-1">
                  Time: {timeSlotStart} - {timeSlotEnd}
                  <button
                    onClick={() => {
                      setTimeSlotStart("");
                      setTimeSlotEnd("");
                    }}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {severityLevel && severityLevel !== "all" && (
                <Badge variant="secondary" className="pr-1">
                  Severity: {severityLevel}
                  <button
                    onClick={() => setSeverityLevel("all")}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
