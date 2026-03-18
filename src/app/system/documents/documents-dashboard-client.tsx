"use client";

import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  History,
  ShieldCheck,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Loader2,
  Mail,
  Send,
  Trash2,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import { DocumentAnalyticsDashboard } from "@/components/documents/analytics";
import { AuditLogViewer } from "@/components/documents/audit";
import {
  DocumentStatusWidget,
  RecentActivityWidget,
  PendingTasksWidget,
  ComplianceWidget,
} from "@/components/documents/widgets";
import { VenueSelector } from "@/components/documents/VenueSelector";
import {
  getDocumentAnalytics,
  getCompletionTrend,
  getCategoryBreakdown,
  getTopDocuments,
  getStrugglingDocuments,
  getUserComplianceReport,
  getRecentDocumentActivity,
  getPendingTasksForUser,
} from "@/lib/actions/documents/analytics";
import {
  getDocumentAuditLogs,
  getAuditLogDetails,
  exportAuditLogs,
  getAuditStats,
} from "@/lib/actions/documents/audit";
import {
  getProspectiveUsers,
  resendProspectiveUserInvitation,
  cancelProspectiveUserAssignment,
  type ProspectiveUser,
} from "@/lib/actions/documents/assignments";
import { exportCompletionReport } from "@/lib/documents/export-service";
import type { DocumentAnalyticsSummary } from "@/components/documents/analytics";
import type { AuditStats } from "@/lib/actions/documents/audit";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentsDashboardClientProps {
  initialVenueId: string | "all";
  allVenues: { id: string; name: string }[];
  initialAnalytics: DocumentAnalyticsSummary | null;
  initialAuditStats: AuditStats | null;
}

export function DocumentsDashboardClient({
  initialVenueId,
  allVenues,
  initialAnalytics,
  initialAuditStats,
}: DocumentsDashboardClientProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVenueId, setSelectedVenueId] = useState<string | "all">(initialVenueId);
  const [analytics, setAnalytics] = useState<DocumentAnalyticsSummary | null>(initialAnalytics);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(initialAuditStats);
  const [isLoading, setIsLoading] = useState(false);
  
  // Prospective users state
  const [prospectiveUsers, setProspectiveUsers] = useState<ProspectiveUser[]>([]);
  const [prospectiveLoading, setProspectiveLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Fetch prospective users when venue changes or tab changes
  const fetchProspectiveUsers = useCallback(async () => {
    setProspectiveLoading(true);
    try {
      const venueId = selectedVenueId === "all" ? undefined : selectedVenueId;
      const result = await getProspectiveUsers(venueId);
      if (result.success && result.data) {
        setProspectiveUsers(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch prospective users:", error);
    } finally {
      setProspectiveLoading(false);
    }
  }, [selectedVenueId]);

  useEffect(() => {
    if (activeTab === "prospective") {
      fetchProspectiveUsers();
    }
  }, [activeTab, fetchProspectiveUsers]);

  // Handle resend invitation
  const handleResendInvitation = async (email: string, venueId: string) => {
    const result = await resendProspectiveUserInvitation(email, venueId);
    if (result.success) {
      toast.success("Invitation resent successfully");
      fetchProspectiveUsers();
    } else {
      toast.error(result.error || "Failed to resend invitation");
    }
  };

  // Handle cancel assignment
  const handleCancelAssignment = async () => {
    if (!selectedAssignmentId) return;
    
    const result = await cancelProspectiveUserAssignment(selectedAssignmentId);
    if (result.success) {
      toast.success("Assignment cancelled");
      setCancelDialogOpen(false);
      setSelectedAssignmentId(null);
      fetchProspectiveUsers();
    } else {
      toast.error(result.error || "Failed to cancel assignment");
    }
  };

  // Get invitation status badge
  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-blue-500">Sent</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "accepted":
        return <Badge variant="default" className="bg-green-500">Accepted</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  // Get selected venue name for display
  const selectedVenueName = selectedVenueId === "all"
    ? "All Venues"
    : allVenues.find(v => v.id === selectedVenueId)?.name || "Unknown Venue";

  // Handle venue change
  const handleVenueChange = useCallback(async (venueId: string | "all") => {
    setIsLoading(true);
    setSelectedVenueId(venueId);

    // Fetch new data for the selected venue
    const [analyticsResult, auditStatsResult] = await Promise.all([
      getDocumentAnalytics(venueId),
      getAuditStats(venueId),
    ]);

    if (analyticsResult.success && analyticsResult.data) {
      setAnalytics(analyticsResult.data);
    }

    if (auditStatsResult.success && auditStatsResult.data) {
      setAuditStats(auditStatsResult.data);
    }

    setIsLoading(false);
  }, []);

  // Analytics callbacks
  const handleFetchAnalytics = useCallback(
    async (venueId: string | "all") => {
      return getDocumentAnalytics(venueId);
    },
    []
  );

  const handleFetchTrend = useCallback(
    async (venueId: string | "all", days?: number) => {
      return getCompletionTrend(venueId, days);
    },
    []
  );

  const handleFetchCategoryBreakdown = useCallback(
    async (venueId: string | "all") => {
      return getCategoryBreakdown(venueId);
    },
    []
  );

  const handleFetchTopDocuments = useCallback(
    async (venueId: string | "all", limit?: number) => {
      return getTopDocuments(venueId, limit);
    },
    []
  );

  const handleFetchStrugglingDocuments = useCallback(
    async (venueId: string | "all", limit?: number) => {
      return getStrugglingDocuments(venueId, limit);
    },
    []
  );

  const handleFetchUserCompliance = useCallback(
    async (venueId: string | "all") => {
      return getUserComplianceReport(venueId);
    },
    []
  );

  const handleExportReport = useCallback(
    async (venueId: string | "all") => {
      return exportCompletionReport({ venueId });
    },
    []
  );

  // Audit log callbacks
  const handleFetchAuditLogs = useCallback(
    async (
      venueId: string | "all",
      filters?: any,
      pagination?: { page: number; pageSize: number }
    ) => {
      return getDocumentAuditLogs(venueId, filters, pagination);
    },
    []
  );

  const handleFetchAuditLogDetails = useCallback(
    async (logId: string, venueId: string | "all") => {
      return getAuditLogDetails(logId, venueId);
    },
    []
  );

  const handleExportAuditLogs = useCallback(
    async (venueId: string | "all", filters?: any) => {
      return exportAuditLogs(venueId, filters);
    },
    []
  );

  // Recent activity callback
  const handleFetchRecentActivity = useCallback(
    async (venueId: string | "all", limit?: number) => {
      return getRecentDocumentActivity(venueId, limit);
    },
    []
  );

  // Pending tasks callback
  const handleFetchPendingTasks = useCallback(async () => {
    return getPendingTasksForUser();
  }, []);

  // Compliance callback
  const handleFetchCompliance = useCallback(
    async (venueId: string | "all"): Promise<{
      success: boolean;
      data?: {
        overallComplianceRate: number;
        totalUsers: number;
        compliantUsers: number;
        nonCompliantUsers: number;
        averageCompletionTime: number | null;
        trend: "up" | "down" | "stable";
      };
      error?: string;
    }> => {
      const result = await getUserComplianceReport(venueId);
      if (result.success && result.data) {
        const users = result.data;
        const compliantUsers = users.filter((u) => u.complianceRate >= 80).length;
        const nonCompliantUsers = users.filter((u) => u.complianceRate < 80).length;
        const avgCompletionTime = users.reduce(
          (sum, u) => sum + (u.averageCompletionTime || 0),
          0
        ) / users.length;

        return {
          success: true,
          data: {
            overallComplianceRate:
              users.length > 0
                ? Math.round(
                    users.reduce((sum, u) => sum + u.complianceRate, 0) / users.length
                  )
                : 100,
            totalUsers: users.length,
            compliantUsers,
            nonCompliantUsers,
            averageCompletionTime: avgCompletionTime || null,
            trend: "stable" as const,
          },
        };
      }
      return { success: false, error: result.error };
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
          <p className="text-muted-foreground">
            Analytics, compliance tracking, and audit logs for document management
          </p>
        </div>
        <div className="flex items-center gap-4">
          <VenueSelector
            venues={allVenues}
            selectedVenueId={selectedVenueId}
            onVenueChange={handleVenueChange}
            showAllOption={true}
            disabled={isLoading}
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold">{analytics.totalDocuments}</p>
                </div>
                <div className="p-2 rounded-full bg-muted text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold">{analytics.completionRate}%</p>
                </div>
                <div
                  className={`p-2 rounded-full ${
                    analytics.completionRate >= 70
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {analytics.completionRate >= 70 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{analytics.pendingAssignments}</p>
                </div>
                <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">
                    {analytics.overdueAssignments}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="prospective" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Prospective Users
          </TabsTrigger>
          <TabsTrigger value="widgets" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Widgets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Widgets Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <DocumentStatusWidget
              venueId={selectedVenueId}
              onFetchStatus={handleFetchAnalytics}
            />
            <ComplianceWidget
              venueId={selectedVenueId}
              onFetchCompliance={handleFetchCompliance}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <RecentActivityWidget
              venueId={selectedVenueId}
              onFetchActivity={handleFetchRecentActivity}
              limit={10}
            />
            <PendingTasksWidget onFetchTasks={handleFetchPendingTasks} />
          </div>

          {/* Audit Stats */}
          {auditStats && (
            <Card>
              <CardHeader>
                <CardTitle>Audit Activity</CardTitle>
                <CardDescription>Recent audit log activity summary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{auditStats.logsToday}</p>
                    <p className="text-sm text-muted-foreground">Today</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{auditStats.logsThisWeek}</p>
                    <p className="text-sm text-muted-foreground">This Week</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{auditStats.logsThisMonth}</p>
                    <p className="text-sm text-muted-foreground">This Month</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{auditStats.totalLogs}</p>
                    <p className="text-sm text-muted-foreground">All Time</p>
                  </div>
                </div>

                {auditStats.topUsers.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Most Active Users</p>
                    <div className="flex flex-wrap gap-2">
                      {auditStats.topUsers.map((user) => (
                        <Badge key={user.userId} variant="secondary">
                          {user.userName} ({user.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <DocumentAnalyticsDashboard
            venueId={selectedVenueId}
            onFetchAnalytics={handleFetchAnalytics}
            onFetchTrend={handleFetchTrend}
            onFetchCategoryBreakdown={handleFetchCategoryBreakdown}
            onFetchTopDocuments={handleFetchTopDocuments}
            onFetchStrugglingDocuments={handleFetchStrugglingDocuments}
            onFetchUserCompliance={handleFetchUserCompliance}
            onExportReport={handleExportReport}
          />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer
            venueId={selectedVenueId}
            onFetchLogs={handleFetchAuditLogs}
            onFetchLogDetails={handleFetchAuditLogDetails}
            onExportLogs={handleExportAuditLogs}
          />
        </TabsContent>

        <TabsContent value="prospective" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Prospective Users
                </CardTitle>
                <CardDescription>
                  Users who have been assigned documents but haven't signed up yet
                  {selectedVenueId === "all" ? " (across all venues)" : ` at ${selectedVenueName}`}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchProspectiveUsers()}
                disabled={prospectiveLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${prospectiveLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {prospectiveLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : prospectiveUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    No prospective users at the moment.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Prospective users will appear here when documents are assigned to email addresses that haven't signed up yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prospectiveUsers.map((prospectiveUser) => (
                    <Card key={prospectiveUser.email}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{prospectiveUser.email}</span>
                            <Badge variant="secondary">
                              {prospectiveUser.totalAssignments} assignment{prospectiveUser.totalAssignments !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Since {format(new Date(prospectiveUser.oldestAssignment), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Document</TableHead>
                              <TableHead>Venue</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Invitation</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {prospectiveUser.assignments.map((assignment) => (
                              <TableRow key={assignment.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {assignment.templateName && (
                                      <>
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span>{assignment.templateName}</span>
                                      </>
                                    )}
                                    {assignment.bundleName && (
                                      <>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <span>{assignment.bundleName}</span>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{assignment.venueName}</TableCell>
                                <TableCell>
                                  {assignment.dueDate
                                    ? format(new Date(assignment.dueDate), "MMM d, yyyy")
                                    : <span className="text-muted-foreground">No due date</span>
                                  }
                                </TableCell>
                                <TableCell>
                                  {getInvitationStatusBadge(assignment.invitationStatus)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {(assignment.invitationStatus === "expired" || assignment.invitationStatus === "none") && (
                                        <DropdownMenuItem
                                          onClick={() => handleResendInvitation(prospectiveUser.email, assignment.venueId)}
                                        >
                                          <Send className="h-4 w-4 mr-2" />
                                          Resend Invitation
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                          setSelectedAssignmentId(assignment.id);
                                          setCancelDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Cancel Assignment
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widgets" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold mb-4">Document Status Widget</h3>
              <DocumentStatusWidget
                venueId={selectedVenueId}
                onFetchStatus={handleFetchAnalytics}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Compliance Widget</h3>
              <ComplianceWidget
                venueId={selectedVenueId}
                onFetchCompliance={handleFetchCompliance}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold mb-4">Recent Activity Widget</h3>
              <RecentActivityWidget
                venueId={selectedVenueId}
                onFetchActivity={handleFetchRecentActivity}
                limit={10}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Pending Tasks Widget</h3>
              <PendingTasksWidget onFetchTasks={handleFetchPendingTasks} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Cancel Assignment Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this assignment? This action cannot be undone.
              The prospective user will no longer receive this document assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedAssignmentId(null)}>
              Keep Assignment
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAssignment} className="bg-destructive text-destructive-foreground">
              Cancel Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
