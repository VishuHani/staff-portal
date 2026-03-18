"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  FileText,
  User,
  Clock,
  Activity,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { AuditAction, ResourceType } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface DocumentAuditLog {
  id: string;
  resourceType: string;
  resourceId: string;
  action: string;
  description: string | null;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  oldValue: any;
  newValue: any;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  submissionId: string | null;
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  action?: AuditAction;
  resourceType?: ResourceType;
  userId?: string;
  resourceId?: string;
}

interface AuditLogViewerProps {
  venueId: string;
  onFetchLogs: (
    venueId: string,
    filters?: AuditLogFilters,
    pagination?: { page: number; pageSize: number }
  ) => Promise<{
    success: boolean;
    data?: {
      logs: DocumentAuditLog[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  }>;
  onExportLogs?: (
    venueId: string,
    filters?: AuditLogFilters
  ) => Promise<{
    success: boolean;
    data?: string;
    filename?: string;
    error?: string;
  }>;
  onFetchLogDetails?: (
    logId: string,
    venueId: string
  ) => Promise<{
    success: boolean;
    data?: DocumentAuditLog;
    error?: string;
  }>;
}

// Color mapping for action types
const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300",
  UPDATED: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
  DELETED: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300",
  ASSIGNED: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300",
  SUBMITTED: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-300",
  REVIEWED: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300",
  REJECTED: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-300",
  VIEWED: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  DOWNLOADED: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  SIGNED: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900 dark:text-teal-300",
  REMINDED: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300",
  WAIVED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900 dark:text-rose-300",
  VERSION_CREATED: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900 dark:text-violet-300",
  VERSION_RESTORED: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900 dark:text-fuchsia-300",
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  TEMPLATE: "Template",
  BUNDLE: "Bundle",
  ASSIGNMENT: "Assignment",
  SUBMISSION: "Submission",
};

// ============================================================================
// Component
// ============================================================================

export function AuditLogViewer({
  venueId,
  onFetchLogs,
  onExportLogs,
  onFetchLogDetails,
}: AuditLogViewerProps) {
  const [logs, setLogs] = useState<DocumentAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [actionFilter, setActionFilter] = useState<string>("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState("");

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<DocumentAuditLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const activeFilters: AuditLogFilters = {};
      if (dateFrom) activeFilters.startDate = dateFrom;
      if (dateTo) activeFilters.endDate = dateTo;
      if (actionFilter) activeFilters.action = actionFilter as AuditAction;
      if (resourceTypeFilter) activeFilters.resourceType = resourceTypeFilter as ResourceType;
      if (userIdFilter) activeFilters.userId = userIdFilter;

      const result = await onFetchLogs(venueId, activeFilters, { page, pageSize });

      if (result.success && result.data) {
        setLogs(result.data.logs);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        setError(result.error || "Failed to fetch audit logs");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, page, pageSize, dateFrom, dateTo, actionFilter, resourceTypeFilter, userIdFilter, onFetchLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    if (!onExportLogs) return;

    try {
      const activeFilters: AuditLogFilters = {};
      if (dateFrom) activeFilters.startDate = dateFrom;
      if (dateTo) activeFilters.endDate = dateTo;
      if (actionFilter) activeFilters.action = actionFilter as AuditAction;
      if (resourceTypeFilter) activeFilters.resourceType = resourceTypeFilter as ResourceType;
      if (userIdFilter) activeFilters.userId = userIdFilter;

      const result = await onExportLogs(venueId, activeFilters);

      if (result.success && result.data && result.filename) {
        const blob = new Blob([result.data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleViewDetails = async (log: DocumentAuditLog) => {
    if (onFetchLogDetails) {
      const result = await onFetchLogDetails(log.id, venueId);
      if (result.success && result.data) {
        setSelectedLog(result.data);
      } else {
        setSelectedLog(log);
      }
    } else {
      setSelectedLog(log);
    }
    setShowDetailDialog(true);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setActionFilter("");
    setResourceTypeFilter("");
    setUserIdFilter("");
    setPage(1);
  };

  const hasActiveFilters = dateFrom || dateTo || actionFilter || resourceTypeFilter || userIdFilter;

  if (isLoading && logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">
            Track all document-related activities and changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                Active
              </Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {onExportLogs && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Date From */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        setPage(1);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        setPage(1);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Action Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Select
                  value={actionFilter}
                  onValueChange={(v) => {
                    setActionFilter(v === "all" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {Object.keys(ACTION_COLORS).map((action) => (
                      <SelectItem key={action} value={action}>
                        {action.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resource Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Resource Type</label>
                <Select
                  value={resourceTypeFilter}
                  onValueChange={(v) => {
                    setResourceTypeFilter(v === "all" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User ID Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">User ID</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="User ID"
                    value={userIdFilter}
                    onChange={(e) => {
                      setUserIdFilter(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchLogs}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs List */}
      {!error && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
            <CardDescription>
              {total.toLocaleString()} total entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "Try adjusting your filters to see more results"
                    : "Audit logs will appear here as activities occur"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {logs.map((log, index) => {
                    const actionColor = ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";

                    return (
                      <div key={log.id}>
                        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          {/* Timestamp */}
                          <div className="flex flex-col items-center min-w-[100px]">
                            <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                            <span className="text-xs font-medium">
                              {format(new Date(log.createdAt), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.createdAt), "HH:mm:ss")}
                            </span>
                          </div>

                          <Separator orientation="vertical" className="h-16" />

                          {/* Main Content */}
                          <div className="flex-1 space-y-2">
                            {/* Action and Resource */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={actionColor} variant="outline">
                                {log.action.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-sm text-muted-foreground">on</span>
                              <Badge variant="secondary">
                                {RESOURCE_TYPE_LABELS[log.resourceType] || log.resourceType}
                              </Badge>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {log.resourceId.substring(0, 8)}...
                              </code>
                            </div>

                            {/* User Info */}
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {log.user ? (
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <span className="text-sm font-medium cursor-pointer hover:underline">
                                      {log.user.name}
                                    </span>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-80">
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold">User Details</h4>
                                      <div className="text-xs space-y-1">
                                        <p><span className="font-medium">Name:</span> {log.user.name}</p>
                                        <p><span className="font-medium">Email:</span> {log.user.email}</p>
                                        {log.ipAddress && (
                                          <p><span className="font-medium">IP:</span> {log.ipAddress}</p>
                                        )}
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              ) : (
                                <span className="text-sm text-muted-foreground">System</span>
                              )}
                            </div>

                            {/* Description */}
                            {log.description && (
                              <p className="text-xs text-muted-foreground">
                                {log.description}
                              </p>
                            )}

                            {/* Value Changes (if present) */}
                            {(log.oldValue || log.newValue) && (
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <button className="text-xs text-primary hover:underline">
                                    View changes
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-96">
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Value Changes</h4>
                                    {log.oldValue && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground">Old Value:</p>
                                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                                          {typeof log.oldValue === "string"
                                            ? log.oldValue
                                            : JSON.stringify(log.oldValue, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {log.newValue && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground">New Value:</p>
                                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                                          {typeof log.newValue === "string"
                                            ? log.newValue
                                            : JSON.stringify(log.newValue, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {log.ipAddress && (
                              <div className="text-xs text-muted-foreground">
                                <Activity className="h-3 w-3 inline mr-1" />
                                {log.ipAddress}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {index < logs.length - 1 && <Separator className="my-2" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {page} of {totalPages} ({total} total entries)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Full details for this audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <Badge className={ACTION_COLORS[selectedLog.action] || ""} variant="outline">
                    {selectedLog.action.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource Type</p>
                  <p className="text-sm">
                    {RESOURCE_TYPE_LABELS[selectedLog.resourceType] || selectedLog.resourceType}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource ID</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    {selectedLog.resourceId}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.createdAt), "PPP p")}
                  </p>
                </div>
              </div>

              {selectedLog.user && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">User</p>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">{selectedLog.user.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedLog.user.email}</p>
                  </div>
                </div>
              )}

              {selectedLog.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{selectedLog.description}</p>
                </div>
              )}

              {selectedLog.oldValue && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Old Value</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {typeof selectedLog.oldValue === "string"
                      ? selectedLog.oldValue
                      : JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">New Value</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {typeof selectedLog.newValue === "string"
                      ? selectedLog.newValue
                      : JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.changes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Changes</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {typeof selectedLog.changes === "string"
                      ? selectedLog.changes
                      : JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}

              {(selectedLog.ipAddress || selectedLog.userAgent) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.ipAddress && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                      <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                    </div>
                  )}
                  {selectedLog.userAgent && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">User Agent</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedLog.userAgent}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AuditLogViewer;
