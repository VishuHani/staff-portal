"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface BundleAnalyticsData {
  bundleId: string;
  bundleName: string;
  category: string;
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null; // in days
  documents: DocumentAnalytics[];
  userCompliance: UserCompliance[];
  completionTrend: TrendData[];
}

export interface DocumentAnalytics {
  templateId: string;
  templateName: string;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null;
  frequentlyIncomplete: boolean;
}

export interface UserCompliance {
  userId: string;
  userName: string;
  userEmail: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  complianceRate: number;
}

export interface TrendData {
  date: string;
  assigned: number;
  completed: number;
}

export interface VenueAnalyticsSummary {
  totalBundles: number;
  activeBundles: number;
  totalAssignments: number;
  completedAssignments: number;
  overallCompletionRate: number;
  averageCompletionTime: number | null;
  topPerformingBundles: BundleAnalyticsData[];
  strugglingBundles: BundleAnalyticsData[];
  categoryBreakdown: { category: string; count: number; completionRate: number }[];
}

interface BundleAnalyticsProps {
  venueId: string;
  onFetchAnalytics: (venueId: string, bundleId?: string) => Promise<{
    success: boolean;
    data?: BundleAnalyticsData | VenueAnalyticsSummary;
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

export function BundleAnalytics({ venueId, onFetchAnalytics }: BundleAnalyticsProps) {
  const [analytics, setAnalytics] = useState<VenueAnalyticsSummary | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<string>("all");
  const [bundleAnalytics, setBundleAnalytics] = useState<BundleAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics on mount and when selection changes
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onFetchAnalytics(venueId, selectedBundle === "all" ? undefined : selectedBundle);

      if (result.success && result.data) {
        if (selectedBundle === "all") {
          setAnalytics(result.data as VenueAnalyticsSummary);
          setBundleAnalytics(null);
        } else {
          setBundleAnalytics(result.data as BundleAnalyticsData);
        }
      } else {
        setError(result.error || "Failed to fetch analytics");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, selectedBundle, onFetchAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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
            <Button variant="outline" className="mt-4" onClick={fetchAnalytics}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bundle Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bundle Analytics</CardTitle>
              <CardDescription>
                Track completion rates, compliance, and performance
              </CardDescription>
            </div>
            <Select value={selectedBundle} onValueChange={setSelectedBundle}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select bundle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bundles</SelectItem>
                {analytics?.topPerformingBundles.map((b) => (
                  <SelectItem key={b.bundleId} value={b.bundleId}>
                    {b.bundleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {selectedBundle === "all" && analytics ? (
        <VenueAnalyticsView analytics={analytics} />
      ) : bundleAnalytics ? (
        <SingleBundleAnalyticsView analytics={bundleAnalytics} />
      ) : null}
    </div>
  );
}

// ============================================================================
// Venue Analytics View
// ============================================================================

function VenueAnalyticsView({ analytics }: { analytics: VenueAnalyticsSummary }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Bundles"
          value={analytics.totalBundles}
          subtitle={`${analytics.activeBundles} active`}
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
          value={`${analytics.overallCompletionRate}%`}
          trend={analytics.overallCompletionRate >= 70 ? "up" : "down"}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <SummaryCard
          title="Avg. Completion Time"
          value={analytics.averageCompletionTime ? `${analytics.averageCompletionTime} days` : "N/A"}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.categoryBreakdown}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {analytics.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completion Rate by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completion Rate by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.categoryBreakdown}>
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
      </div>

      {/* Top Performing & Struggling Bundles */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Top Performing Bundles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topPerformingBundles.slice(0, 5).map((bundle) => (
                  <TableRow key={bundle.bundleId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{bundle.bundleName}</p>
                        <p className="text-xs text-muted-foreground">{bundle.category}</p>
                      </div>
                    </TableCell>
                    <TableCell>{bundle.totalAssignments}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={bundle.completionRate} className="w-16" />
                        <span className="text-sm">{bundle.completionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {analytics.topPerformingBundles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No bundles yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.strugglingBundles.slice(0, 5).map((bundle) => (
                  <TableRow key={bundle.bundleId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{bundle.bundleName}</p>
                        <p className="text-xs text-muted-foreground">{bundle.category}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={bundle.overdueAssignments > 0 ? "destructive" : "secondary"}>
                        {bundle.overdueAssignments}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={bundle.completionRate} className="w-16" />
                        <span className="text-sm">{bundle.completionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {analytics.strugglingBundles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      All bundles performing well
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Single Bundle Analytics View
// ============================================================================

function SingleBundleAnalyticsView({ analytics }: { analytics: BundleAnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Assignments"
          value={analytics.totalAssignments}
          icon={<Users className="h-4 w-4" />}
        />
        <SummaryCard
          title="Completed"
          value={analytics.completedAssignments}
          subtitle={`${analytics.completionRate}% rate`}
          icon={<CheckCircle className="h-4 w-4" />}
          trend={analytics.completionRate >= 70 ? "up" : "down"}
        />
        <SummaryCard
          title="In Progress"
          value={analytics.inProgressAssignments}
          icon={<Activity className="h-4 w-4" />}
        />
        <SummaryCard
          title="Overdue"
          value={analytics.overdueAssignments}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={analytics.overdueAssignments > 0 ? "destructive" : "default"}
        />
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Document Performance</TabsTrigger>
          <TabsTrigger value="users">User Compliance</TabsTrigger>
          <TabsTrigger value="trends">Completion Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Completion Rates</CardTitle>
              <CardDescription>
                Individual document performance within this bundle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead>Avg. Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.documents.map((doc) => (
                    <TableRow key={doc.templateId}>
                      <TableCell className="font-medium">{doc.templateName}</TableCell>
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
                      <TableCell>
                        {doc.frequentlyIncomplete ? (
                          <Badge variant="destructive">Needs Attention</Badge>
                        ) : (
                          <Badge variant="secondary">On Track</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {analytics.documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No documents in this bundle
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Compliance</CardTitle>
              <CardDescription>
                Individual user completion rates for this bundle
              </CardDescription>
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
                  {analytics.userCompliance.map((user) => (
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
                  {analytics.userCompliance.length === 0 && (
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

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Completion Trends</CardTitle>
              <CardDescription>
                Assignment and completion trends over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.completionTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.completionTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="assigned"
                      stroke="#3b82f6"
                      name="Assigned"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#22c55e"
                      name="Completed"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No trend data available yet
                </div>
              )}
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
            <p className={cn(
              "text-2xl font-bold",
              variant === "destructive" && "text-destructive"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-2 rounded-full",
            trend === "up" && "bg-green-100 text-green-600",
            trend === "down" && "bg-red-100 text-red-600",
            !trend && "bg-muted text-muted-foreground"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Need to import Button
import { Button } from "@/components/ui/button";

export default BundleAnalytics;
