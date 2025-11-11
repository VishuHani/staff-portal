"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { FileText, Filter, Download, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditLogsTable } from "@/components/admin/AuditLogsTable";
import { getAuditLogs } from "@/lib/actions/admin/audit-logs";
import { toast } from "sonner";

interface AuditLogsPageClientProps {
  stats: {
    total: number;
    last24Hours: number;
    byActionType: Array<{ actionType: string; count: number }>;
    byResourceType: Array<{ resourceType: string; count: number }>;
    topUsers: Array<{
      userId: string;
      count: number;
      name: string;
      email: string;
    }>;
  };
  filterOptions: {
    actionTypes: string[];
    resourceTypes: string[];
    users: Array<{ id: string; name: string; email: string }>;
  };
}

export function AuditLogsPageClient({ stats, filterOptions }: AuditLogsPageClientProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [userId, setUserId] = useState<string>("");
  const [actionType, setActionType] = useState<string>("");
  const [resourceType, setResourceType] = useState<string>("");
  const [resourceId, setResourceId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Load logs when filters change
  useEffect(() => {
    loadLogs();
  }, [userId, actionType, resourceType, resourceId, startDate, endDate, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        userId: userId || undefined,
        actionType: actionType || undefined,
        resourceType: resourceType || undefined,
        resourceId: resourceId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });

      if (result.success) {
        setLogs(result.logs);
        setTotal(result.total);
      } else {
        toast.error(result.error || "Failed to load audit logs");
      }
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setUserId("");
    setActionType("");
    setResourceType("");
    setResourceId("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const handleExport = () => {
    toast.info("Export functionality coming soon");
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="mt-2 text-muted-foreground">
            View and monitor all system activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All recorded activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last24Hours.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Recent activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Action</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byActionType[0]?.actionType || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.byActionType[0]?.count || 0} occurrences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Resource</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byResourceType[0]?.resourceType || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.byResourceType[0]?.count || 0} activities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filter Logs</CardTitle>
              <CardDescription>
                Narrow down results by applying filters
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {/* User Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">User</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All users</SelectItem>
                  {filterOptions.users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  {filterOptions.actionTypes.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resource Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Resource Type</label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All resources</SelectItem>
                  {filterOptions.resourceTypes.map(resource => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resource ID Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Resource ID</label>
              <Input
                placeholder="Search by ID..."
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <AuditLogsTable
        logs={logs}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {/* Pagination Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} logs
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
