"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimeOffRequest } from "@/lib/actions/reports/time-off-reports";

interface TimeOffListProps {
  requests: TimeOffRequest[];
}

type SortField = "userName" | "startDate" | "endDate" | "status" | "type";
type SortDirection = "asc" | "desc";

interface StatusBadgeProps {
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}

function StatusBadge({ status }: StatusBadgeProps) {
  const variants: Record<typeof status, { variant: any; label: string; className?: string }> = {
    PENDING: { variant: "secondary", label: "Pending", className: "bg-yellow-100 text-yellow-800" },
    APPROVED: { variant: "default", label: "Approved", className: "bg-green-100 text-green-800" },
    REJECTED: { variant: "destructive", label: "Rejected" },
    CANCELLED: { variant: "outline", label: "Cancelled" },
  };

  const { variant, label, className } = variants[status];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

export function TimeOffList({ requests }: TimeOffListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort requests
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = requests;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = requests.filter(
        (req) =>
          req.userName.toLowerCase().includes(query) ||
          req.userEmail.toLowerCase().includes(query) ||
          req.userRole.toLowerCase().includes(query) ||
          req.type.toLowerCase().includes(query) ||
          req.reason?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "userName":
          aValue = a.userName.toLowerCase();
          bValue = b.userName.toLowerCase();
          break;
        case "startDate":
          aValue = new Date(a.startDate).getTime();
          bValue = new Date(b.startDate).getTime();
          break;
        case "endDate":
          aValue = new Date(a.endDate).getTime();
          bValue = new Date(b.endDate).getTime();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [requests, searchQuery, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Time-Off Requests List</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredAndSortedRequests.length} request{filteredAndSortedRequests.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, role, type, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No time-off requests match your search" : "No time-off requests found"}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-medium"
                      onClick={() => handleSort("userName")}
                    >
                      Staff Member
                      <SortIcon field="userName" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-medium"
                      onClick={() => handleSort("startDate")}
                    >
                      Start Date
                      <SortIcon field="startDate" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-medium"
                      onClick={() => handleSort("endDate")}
                    >
                      End Date
                      <SortIcon field="endDate" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-medium"
                      onClick={() => handleSort("type")}
                    >
                      Type
                      <SortIcon field="type" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-medium"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <SortIcon field="status" />
                    </Button>
                  </TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reviewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{request.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {request.userRole}
                        </span>
                        {request.userVenues.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {request.userVenues.join(", ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.startDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.endDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={request.reason}>
                        {request.reason || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.reviewerName || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
