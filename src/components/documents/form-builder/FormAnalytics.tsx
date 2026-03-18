'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Download,
  Calendar,
  Monitor,
  Smartphone,
  Tablet,
  ArrowUp,
  ArrowDown,
  Minus,
  Lightbulb,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AnalyticsReport,
  FormCompletionMetrics,
  DropOffAnalysis,
  FieldAnalytics,
  SubmissionTrends,
  FieldDropOff,
  DropOffRecommendation,
} from '@/lib/types/form-analytics';

// ============================================================================
// CHART COLORS
// ============================================================================

const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#6366f1',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#94a3b8',
};

const PIE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#6366f1',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
];

// ============================================================================
// METRIC CARD
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  description,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!change) return null;
    if (trend === 'up') return <ArrowUp className="h-3 w-3" />;
    if (trend === 'down') return <ArrowDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-500';
    if (trend === 'down') return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={cn("flex items-center gap-1 text-xs", getTrendColor())}>
                {getTrendIcon()}
                <span>{Math.abs(change)}% {changeLabel}</span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="p-3 rounded-full bg-primary/10">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPLETION METRICS PANEL
// ============================================================================

interface CompletionMetricsPanelProps {
  metrics: FormCompletionMetrics;
}

function CompletionMetricsPanel({ metrics }: CompletionMetricsPanelProps) {
  const deviceData = [
    { name: 'Desktop', value: metrics.deviceBreakdown.desktop, icon: Monitor },
    { name: 'Mobile', value: metrics.deviceBreakdown.mobile, icon: Smartphone },
    { name: 'Tablet', value: metrics.deviceBreakdown.tablet, icon: Tablet },
    { name: 'Other', value: metrics.deviceBreakdown.other, icon: Monitor },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Views"
          value={metrics.totalViews.toLocaleString()}
          icon={<Users className="h-5 w-5 text-primary" />}
          description={`${metrics.uniqueViews.toLocaleString()} unique`}
        />
        <MetricCard
          title="Form Starts"
          value={metrics.totalStarts.toLocaleString()}
          change={metrics.startRate}
          changeLabel="start rate"
          icon={<Activity className="h-5 w-5 text-primary" />}
          trend={metrics.startRate > 50 ? 'up' : 'down'}
        />
        <MetricCard
          title="Completions"
          value={metrics.totalCompletions.toLocaleString()}
          change={metrics.completionRate}
          changeLabel="completion rate"
          icon={<CheckCircle className="h-5 w-5 text-primary" />}
          trend={metrics.completionRate > 70 ? 'up' : 'down'}
        />
        <MetricCard
          title="Avg. Time"
          value={formatTime(metrics.averageCompletionTime)}
          icon={<Clock className="h-5 w-5 text-primary" />}
          description={`Median: ${formatTime(metrics.medianCompletionTime)}`}
        />
      </div>

      {/* Device Breakdown */}
      {deviceData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// DROP-OFF ANALYSIS PANEL
// ============================================================================

interface DropOffAnalysisPanelProps {
  analysis: DropOffAnalysis;
}

function DropOffAnalysisPanel({ analysis }: DropOffAnalysisPanelProps) {
  const sortedFieldDropOffs = [...analysis.fieldDropOffs].sort(
    (a, b) => b.dropOffRate - a.dropOffRate
  );

  return (
    <div className="space-y-6">
      {/* Overall Drop-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Overall Drop-off Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-destructive">
              {analysis.overallDropOffRate}%
            </div>
            <Progress
              value={100 - analysis.overallDropOffRate}
              className="flex-1 h-4"
            />
            <div className="text-sm text-muted-foreground">
              {100 - analysis.overallDropOffRate}% complete
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Drop-offs */}
      {sortedFieldDropOffs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Field Drop-off Analysis</CardTitle>
            <CardDescription>
              Fields where users are most likely to abandon the form
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedFieldDropOffs.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="fieldName" type="category" width={100} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Drop-off Rate']}
                  />
                  <Bar
                    dataKey="dropOffRate"
                    fill={CHART_COLORS.danger}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.recommendations
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 5)
                .map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// RECOMMENDATION CARD
// ============================================================================

interface RecommendationCardProps {
  recommendation: DropOffRecommendation;
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium">{recommendation.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {recommendation.description}
          </p>
        </div>
        <div className="flex gap-1 ml-2">
          <Badge className={cn('text-xs', getImpactColor(recommendation.impact))}>
            {recommendation.impact} impact
          </Badge>
          <Badge className={cn('text-xs', getEffortColor(recommendation.effort))}>
            {recommendation.effort} effort
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBMISSION TRENDS PANEL
// ============================================================================

interface SubmissionTrendsPanelProps {
  trends: SubmissionTrends;
}

function SubmissionTrendsPanel({ trends }: SubmissionTrendsPanelProps) {
  const [view, setView] = React.useState<'daily' | 'weekly' | 'monthly'>('daily');

  const getData = () => {
    switch (view) {
      case 'daily':
        return trends.daily;
      case 'weekly':
        return trends.weekly;
      case 'monthly':
        return trends.monthly;
      default:
        return trends.daily;
    }
  };

  return (
    <div className="space-y-6">
      {/* Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Daily Change</p>
                <p className={cn(
                  "text-lg font-bold flex items-center gap-1",
                  trends.trends.dailyChange >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {trends.trends.dailyChange >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {Math.abs(trends.trends.dailyChange)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Weekly Change</p>
                <p className={cn(
                  "text-lg font-bold flex items-center gap-1",
                  trends.trends.weeklyChange >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {trends.trends.weeklyChange >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {Math.abs(trends.trends.weeklyChange)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Monthly Change</p>
                <p className={cn(
                  "text-lg font-bold flex items-center gap-1",
                  trends.trends.monthlyChange >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {trends.trends.monthlyChange >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {Math.abs(trends.trends.monthlyChange)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Submission Trends</CardTitle>
          <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS.primary}
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Hourly & Day of Week Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Hourly Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}:00`}
                    interval={3}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(h) => `${h}:00 - ${h + 1}:00`}
                    formatter={(value: number) => [value, 'Submissions']}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS.info} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Day of Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.dayOfWeekDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(0, 3)} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.secondary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// FIELD ANALYTICS PANEL
// ============================================================================

interface FieldAnalyticsPanelProps {
  fieldAnalytics: FieldAnalytics[];
}

function FieldAnalyticsPanel({ fieldAnalytics }: FieldAnalyticsPanelProps) {
  if (fieldAnalytics.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No field analytics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fieldAnalytics.map((field) => (
        <Card key={field.fieldId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">{field.fieldName}</CardTitle>
                <Badge variant="outline" className="mt-1">{field.fieldType}</Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Fill Rate: </span>
                  <span className={cn(
                    "font-medium",
                    field.fillRate >= 80 ? "text-green-500" :
                    field.fillRate >= 50 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {field.fillRate}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Error Rate: </span>
                  <span className={cn(
                    "font-medium",
                    field.errorRate <= 5 ? "text-green-500" :
                    field.errorRate <= 15 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {field.errorRate}%
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Avg. Time</p>
                <p className="font-medium">{formatTime(field.averageTime)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Errors</p>
                <p className="font-medium">{field.commonErrors.length} types</p>
              </div>
            </div>
            {field.commonErrors.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Common Errors:</p>
                <div className="flex flex-wrap gap-2">
                  {field.commonErrors.slice(0, 3).map((error, idx) => (
                    <Badge key={idx} variant="destructive" className="text-xs">
                      {error.message || String(error)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// FORM ANALYTICS DASHBOARD
// ============================================================================

export interface FormAnalyticsDashboardProps {
  report: AnalyticsReport;
  onExport?: (format: 'pdf' | 'csv' | 'json') => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function FormAnalyticsDashboard({
  report,
  onExport,
  onRefresh,
  isLoading,
}: FormAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = React.useState('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{report.formName} Analytics</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          )}
          {onExport && (
            <Select onValueChange={(v) => onExport(v as 'pdf' | 'csv' | 'json')}>
              <SelectTrigger className="w-32">
                <Download className="h-4 w-4 mr-2" />
                Export
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Health Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg className="h-24 w-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${report.summary.score * 2.51} 251`}
                  className={cn(
                    report.summary.score >= 80 ? "text-green-500" :
                    report.summary.score >= 60 ? "text-yellow-500" :
                    report.summary.score >= 40 ? "text-orange-500" : "text-red-500"
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{report.summary.score}</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Form Health Score</h3>
              <p className="text-sm text-muted-foreground">
                Based on completion rate, drop-off analysis, and field performance
              </p>
              {report.summary.keyFindings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {report.summary.keyFindings.slice(0, 3).map((finding, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      {finding}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dropoff">Drop-off</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <CompletionMetricsPanel metrics={report.completionMetrics} />
        </TabsContent>

        <TabsContent value="dropoff" className="mt-6">
          <DropOffAnalysisPanel analysis={report.dropOffAnalysis} />
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <SubmissionTrendsPanel trends={report.trends} />
        </TabsContent>

        <TabsContent value="fields" className="mt-6">
          <FieldAnalyticsPanel fieldAnalytics={report.fieldAnalytics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default FormAnalyticsDashboard;