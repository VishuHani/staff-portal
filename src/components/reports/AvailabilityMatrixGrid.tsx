"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Check, X, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MatrixCell {
  date: string;
  status: "available" | "unavailable" | "partial";
  timeSlots?: string[];
}

interface MatrixRow {
  userId: string;
  userName: string;
  userEmail: string;
  cells: MatrixCell[];
}

interface AvailabilityMatrixData {
  dates: string[];
  users: MatrixRow[];
}

interface AvailabilityMatrixGridProps {
  data: AvailabilityMatrixData;
  searchQuery?: string;
}

export function AvailabilityMatrixGrid({ data, searchQuery = "" }: AvailabilityMatrixGridProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    if (!localSearch.trim()) return data.users;

    const query = localSearch.toLowerCase();
    return data.users.filter(
      (user) =>
        user.userName?.toLowerCase().includes(query) ||
        user.userEmail?.toLowerCase().includes(query)
    );
  }, [data?.users, localSearch]);

  // Status colors and icons
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 border-green-300 hover:bg-green-200";
      case "unavailable":
        return "bg-red-100 text-red-800 border-red-300 hover:bg-red-200";
      case "partial":
        return "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <Check className="h-4 w-4" />;
      case "unavailable":
        return <X className="h-4 w-4" />;
      case "partial":
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Available all day";
      case "unavailable":
        return "Unavailable";
      case "partial":
        return "Partially available";
      default:
        return "Unknown";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Staff Availability</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredUsers.length} staff members</span>
            <span>•</span>
            <span>{data.dates.length} days</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff by name or email..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
            <span>Unavailable</span>
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* Header with Sticky positioning */}
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {/* Staff Name Column - Also Sticky */}
                      <th
                        scope="col"
                        className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
                      >
                        Staff Member
                      </th>
                      {/* Date Columns */}
                      {data.dates.map((date) => (
                        <th
                          key={date}
                          scope="col"
                          className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          <div>{format(new Date(date), "EEE")}</div>
                          <div className="font-normal text-gray-400">
                            {format(new Date(date), "MMM d")}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* Body */}
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={data.dates.length + 1}
                          className="px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          No staff members found matching "{localSearch}"
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          {/* Staff Name - Sticky */}
                          <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">
                                {user.userName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {user.userEmail}
                              </span>
                            </div>
                          </td>

                          {/* Availability Cells */}
                          {user.cells.map((cell, idx) => (
                            <td key={idx} className="px-2 py-2 text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "inline-flex items-center justify-center w-10 h-10 rounded border cursor-pointer transition-colors",
                                        getStatusStyle(cell.status)
                                      )}
                                    >
                                      {getStatusIcon(cell.status)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-medium">
                                        {format(new Date(cell.date), "MMMM d, yyyy")}
                                      </p>
                                      <p className="text-sm">
                                        {getStatusLabel(cell.status)}
                                      </p>
                                      {cell.timeSlots && cell.timeSlots.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <p className="text-xs font-medium">Time Slots:</p>
                                          {cell.timeSlots.map((slot, i) => (
                                            <p key={i} className="text-xs">
                                              {slot}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {localSearch && filteredUsers.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {data.users.length} staff members
          </div>
        )}
      </CardContent>
    </Card>
  );
}
