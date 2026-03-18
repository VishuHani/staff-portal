"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Users,
  Download,
  RefreshCw,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface DocumentAnalyticsSummary {
  totalDocuments: number;
  activeDocuments: number;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  inProgressAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null;
  recentlyCompleted: number;
  upcomingDeadlines: number;
}

export interface CompletionTrendData {
  date: string;
  assigned: number;
  completed: number;
  pending: number;
}

export interface CategoryBreakdownData {
  category: string;
  count: number;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  [key: string]: string | number;
}

export interface TopDocumentData {
  templateId: string;
  templateName: string;
  category: string;
  documentType: string;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null;
}

export interface StrugglingDocumentData {
  templateId: string;
  templateName: string;
  category: string;
  documentType: string;
  totalAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  frequentlyIncomplete: boolean;
}

export interface UserComplianceReport {
  userId: string;
  userName: string;
  userEmail: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  complianceRate: number;
  averageCompletionTime: number | null;
}

interface DocumentAnalyticsDashboardProps {
  venueId: string;
  onFetchAnalytics: (venueId: string) => Promise<{
    success: boolean;
    data?: DocumentAnalyticsSummary;
    error?: string;
  }>;
  onFetchTrend: (venueId: string, days?: number) => Promise<{
    success: boolean;
    data?: CompletionTrendData[];
    error?: string;
  }>;
  onFetchCategoryBreakdown: (venueId: string) => Promise<{
    success: boolean;
    data?: CategoryBreakdownData[];
    error?: string;
  }>;
  onFetchTopDocuments: (venueId: string, limit?: number) => Promise<{
    success: boolean;
    data?: TopDocumentData[];
    error?: string;
  }>;
  onFetchStrugglingDocuments: (venueId: string, limit?: number) => Promise<{
    success: boolean;
    data?: StrugglingDocumentData[];
    error?: string;
  }>;
  onFetchUserCompliance: (venueId: string) => Promise<{
    success: boolean;
    data?: UserComplianceReport[];
    error?: string;
  }>;
  onExportReport?: (venueId: string) => Promise<{
    success: boolean;
    data?: string;
    filename?: string;
    error?: string;
  }>;
}

const COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

// ============================================================================
// Component
// ============================================================================

export function DocumentAnalyticsDashboard({
  venueId,
  onFetchAnalytics,
  onFetchTrend,
  onFetchCategoryBreakdown,
  onFetchTopDocuments,
  onFetchStrugglingDocuments,
  onFetchUserCompliance,
  onExportReport,
}: DocumentAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<DocumentAnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<CompletionTrendData[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownData[]>([]);
  const [topDocuments, setTopDocuments] = useState<TopDocumentData[]>([]);
  const [strugglingDocuments, setStrugglingDocuments] = useState<StrugglingDocumentData[]>([]);
  const [userCompliance, setUserCompliance] = useState<UserComplianceReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(30);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        analyticsResult,
        trendResult,
        categoryResult,
        topResult,
        strugglingResult,
        complianceResult,
      ] = await Promise.all([
        onFetchAnalytics(venueId),
        onFetchTrend(venueId, trendDays),
        onFetchCategoryBreakdown(venueId),
        onFetchTopDocuments(venueId, 10),
        onFetchStrugglingDocuments(venueId, 10),
        onFetchUserCompliance(venueId),
      ]);

      if (analyticsResult.success && analyticsResult.data) {
        setAnalytics(analyticsResult.data);
      } else {
        setError(analyticsResult.error || "Failed to fetch analytics");
      }

      if (trendResult.success && trendResult.data) {
        setTrend(trendResult.data);
      }

      if (categoryResult.success && categoryResult.data) {
        setCategoryBreakdown(categoryResult.data);
      }

      if (topResult.success && topResult.data) {
        setTopDocuments(topResult.data);
      }

      if (strugglingResult.success && strugglingResult.data) {
        setStrugglingDocuments(strugglingResult.data);
      }

      if (complianceResult.success && complianceResult.data) {
        setUserCompliance(complianceResult.data);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, trendDays, onFetchAnalytics, onFetchTrend, onFetchCategoryBreakdown, onFetchTopDocuments, onFetchStrugglingDocuments, onFetchUserCompliance]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleExport = async () => {
    if (!onExportReport) return;
    
    try {
      const result = await onExportReport(venueId);
      if (result.success && result.data && result.filename) {
        // Create download
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchAllData}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Analytics</h2>
          <p className="text-muted-foreground">
            Track document completion, compliance, and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {onExportReport && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Documents"
            value={analytics.totalDocuments}
            subtitle={`${analytics.activeDocuments} active`}
            icon={<FileText className="h-4 w-4" />}
          />
          <SummaryCard
            title="Total Assignments"
            value={analytics.totalAssignments}
            subtitle={`${analytics.completedAssignments} completed`}
            icon={<Users className="h-4 w-4" />}
          />
          <SummaryCard
            title="Completion Rate"
            value={`${analytics.completionRate}%`}
            trend={analytics.completionRate >= 70 ? "up" : "down"}
            icon={<CheckCircle className="h-4 w-4" />}
          />
          <SummaryCard
            title="Overdue"
            value={analytics.overdueAssignments}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant={analytics.overdueAssignments > 0 ? "destructive" : "default"}
          />
        </div>
      )}

      {/* Additional Stats Row */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recently Completed</p>
                  <p className="text-2xl font-bold">{analytics.recentlyCompleted}</p>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
                <div className="p-2 rounded-full bg-green-100 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Upcoming Deadlines</p>
                  <p className="text-2xl font-bold">{analytics.upcomingDeadlines}</p>
                  <p className="text-xs text-muted-foreground">Next 7 days</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Avg. Completion Time</p>
                  <p className="text-2xl font-bold">
                    {analytics.averageCompletionTime ? `${analytics.averageCompletionTime} days` : "N/A"}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-muted text-muted-foreground">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Completion Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Completion Trend</CardTitle>
                <CardDescription>Document assignments and completions over time</CardDescription>
              </div>
              <Select
                value={String(trendDays)}
                onValueChange={(v) => setTrendDays(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v), "MMM d")}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="assigned"
                    stroke="#3b82f6"
                    name="Assigned"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#22c55e"
                    name="Completed"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documents by Category</CardTitle>
            <CardDescription>Distribution of documents across categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Completion Rate Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Completion Rate by Category</CardTitle>
          <CardDescription>How well each category is performing</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, "Completion Rate"]} />
                <Bar dataKey="completionRate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="top" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top">Top Performing</TabsTrigger>
          <TabsTrigger value="struggling">Needs Attention</TabsTrigger>
          <TabsTrigger value="compliance">User Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Top Performing Documents
              </CardTitle>
              <CardDescription>Documents with the highest completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead>Avg. Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDocuments.map((doc) => (
                    <TableRow key={doc.templateId}>
                      <TableCell className="font-medium">{doc.templateName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{doc.category}</Badge>
                      </TableCell>
                      <TableCell>{doc.totalAssignments}</TableCell>
                      <TableCell>{doc.completedAssignments}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={doc.completionRate} className="w-16" />
                          <span className="text-sm">{doc.completionRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.averageCompletionTime ? `${doc.averageCompletionTime}d` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topDocuments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No documents with assignments yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="struggling">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Documents Needing Attention
              </CardTitle>
              <CardDescription>Documents with low completion rates or overdue assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {strugglingDocuments.map((doc) => (
                    <TableRow key={doc.templateId}>
                      <TableCell className="font-medium">{doc.templateName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{doc.category}</Badge>
                      </TableCell>
                      <TableCell>{doc.pendingAssignments}</TableCell>
                      <TableCell>
                        {doc.overdueAssignments > 0 ? (
                          <Badge variant="destructive">{doc.overdueAssignments}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={doc.completionRate}
                            className={cn(
                              "w-16",
                              doc.completionRate < 50 && "[&>div]:bg-destructive"
                            )}
                          />
                          <span className="text-sm">{doc.completionRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.frequentlyIncomplete ? (
                          <Badge variant="destructive">Needs Attention</Badge>
                        ) : (
                          <Badge variant="secondary">Monitor</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {strugglingDocuments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        All documents performing well
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Compliance Report</CardTitle>
              <CardDescription>Individual user completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>In Progress</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userCompliance.slice(0, 20).map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.userName}</p>
                          <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>{user.totalAssigned}</TableCell>
                      <TableCell>{user.completed}</TableCell>
                      <TableCell>{user.inProgress}</TableCell>
                      <TableCell>
                        {user.overdue > 0 && (
                          <Badge variant="destructive">{user.overdue}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={user.complianceRate}
                            className={cn(
                              "w-16",
                              user.complianceRate < 50 && "[&>div]:bg-destructive"
                            )}
                          />
                          <span className="text-sm">{user.complianceRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {userCompliance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No user assignments yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
  variant?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                "text-2xl font-bold",
                variant === "destructive" && "text-destructive"
              )}
            >
              {value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div
            className={cn(
              "p-2 rounded-full",
              trend === "up" && "bg-green-100 text-green-600",
              trend === "down" && "bg-red-100 text-red-600",
              !trend && variant === "destructive" && "bg-red-100 text-red-600",
              !trend && variant === "default" && "bg-muted text-muted-foreground"
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DocumentAnalyticsDashboard;
