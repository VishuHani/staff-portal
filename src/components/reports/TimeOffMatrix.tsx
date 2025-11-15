"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TimeOffRequest } from "@/lib/actions/reports/time-off-reports";

interface TimeOffMatrixProps {
  requests: TimeOffRequest[];
  dates: string[];
}

interface MatrixCell {
  request: TimeOffRequest | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
}

export function TimeOffMatrix({ requests, dates }: TimeOffMatrixProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Group requests by user
  const userRequests = useMemo(() => {
    const grouped = new Map<string, TimeOffRequest[]>();

    requests.forEach((req) => {
      if (!grouped.has(req.userId)) {
        grouped.set(req.userId, []);
      }
      grouped.get(req.userId)!.push(req);
    });

    return grouped;
  }, [requests]);

  // Get unique users
  const users = useMemo(() => {
    const uniqueUsers = new Map<string, { id: string; name: string; email: string; role: string }>();

    requests.forEach((req) => {
      if (!uniqueUsers.has(req.userId)) {
        uniqueUsers.set(req.userId, {
          id: req.userId,
          name: req.userName,
          email: req.userEmail,
          role: req.userRole,
        });
      }
    });

    return Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);

  // Filter users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Get cell data for specific user and date
  const getCellData = (userId: string, dateStr: string): MatrixCell => {
    const userReqs = userRequests.get(userId) || [];
    const date = parseISO(dateStr);

    // Find request that overlaps this date
    const matchingRequest = userReqs.find((req) => {
      const start = parseISO(req.startDate);
      const end = parseISO(req.endDate);
      return date >= start && date <= end;
    });

    if (matchingRequest) {
      return {
        request: matchingRequest,
        status: matchingRequest.status,
      };
    }

    return { request: null, status: null };
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "bg-white";

    switch (status) {
      case "PENDING":
        return "bg-yellow-100 border-yellow-300 hover:bg-yellow-200";
      case "APPROVED":
        return "bg-green-100 border-green-300 hover:bg-green-200";
      case "REJECTED":
        return "bg-red-100 border-red-300 hover:bg-red-200";
      case "CANCELLED":
        return "bg-gray-100 border-gray-300 hover:bg-gray-200";
      default:
        return "bg-white";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Pending";
      case "APPROVED":
        return "Approved";
      case "REJECTED":
        return "Rejected";
      case "CANCELLED":
        return "Cancelled";
      default:
        return "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Time-Off Matrix</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredUsers.length} staff members</span>
            <span>•</span>
            <span>{dates.length} days</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
            <span>Rejected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300" />
            <span>Cancelled</span>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No staff members match your search" : "No time-off requests found"}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <TooltipProvider>
                  <table className="min-w-full divide-y divide-gray-200">
                    {/* Header */}
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th
                          scope="col"
                          className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r min-w-[200px]"
                        >
                          Staff Member
                        </th>
                        {dates.map((dateStr) => (
                          <th
                            key={dateStr}
                            scope="col"
                            className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]"
                          >
                            <div>{format(parseISO(dateStr), "EEE")}</div>
                            <div className="text-base font-semibold text-gray-900">
                              {format(parseISO(dateStr), "d")}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    {/* Body */}
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          {/* User Info */}
                          <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r">
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{user.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {user.role}
                              </span>
                            </div>
                          </td>

                          {/* Date Cells */}
                          {dates.map((dateStr) => {
                            const cellData = getCellData(user.id, dateStr);

                            if (!cellData.status) {
                              return (
                                <td
                                  key={dateStr}
                                  className="px-2 py-2 text-center"
                                >
                                  <div className="w-full h-8 rounded border border-gray-100" />
                                </td>
                              );
                            }

                            return (
                              <td
                                key={dateStr}
                                className="px-2 py-2 text-center"
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "w-full h-8 rounded border cursor-pointer transition-colors flex items-center justify-center",
                                        getStatusColor(cellData.status)
                                      )}
                                    >
                                      <span className="text-xs font-medium">
                                        {cellData.status.charAt(0)}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1">
                                      <div className="font-semibold">
                                        {getStatusLabel(cellData.status)}
                                      </div>
                                      <div className="text-xs">
                                        {format(parseISO(cellData.request!.startDate), "MMM d")} -{" "}
                                        {format(parseISO(cellData.request!.endDate), "MMM d, yyyy")}
                                      </div>
                                      <div className="text-xs">
                                        Type: {cellData.request!.type}
                                      </div>
                                      {cellData.request!.reason && (
                                        <div className="text-xs">
                                          Reason: {cellData.request!.reason}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TooltipProvider>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
