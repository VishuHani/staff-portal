/**
 * Form Analytics Types
 * 
 * This module defines TypeScript types for form analytics, including
 * completion metrics, drop-off analysis, and response analytics.
 */

// ============================================================================
// COMPLETION METRICS
// ============================================================================

/**
 * Overall form completion metrics
 */
export interface FormCompletionMetrics {
  formId: string;
  formName: string;
  
  // View metrics
  totalViews: number;
  uniqueViews: number;
  
  // Start metrics
  totalStarts: number;
  startRate: number; // Percentage of views that started
  
  // Completion metrics
  totalCompletions: number;
  completionRate: number; // Percentage of starts that completed
  
  // Time metrics
  averageCompletionTime: number; // in seconds
  medianCompletionTime: number;
  minCompletionTime: number;
  maxCompletionTime: number;
  
  // Device breakdown
  deviceBreakdown: DeviceBreakdown;
  
  // Time period
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Device type breakdown
 */
export interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
  other: number;
}

// ============================================================================
// DROP-OFF ANALYSIS
// ============================================================================

/**
 * Drop-off analysis for form fields
 */
export interface DropOffAnalysis {
  formId: string;
  
  // Overall drop-off
  overallDropOffRate: number;
  
  // Drop-off by field
  fieldDropOffs: FieldDropOff[];
  
  // Drop-off by page (for multi-page forms)
  pageDropOffs?: PageDropOff[];
  
  // Common drop-off patterns
  patterns: DropOffPattern[];
  
  // Recommendations
  recommendations: DropOffRecommendation[];
}

/**
 * Drop-off data for a single field
 */
export interface FieldDropOff {
  fieldId: string;
  fieldName: string;
  fieldType: string;
  
  // Metrics
  views: number; // How many users saw this field
  fills: number; // How many users filled this field
  skips: number; // How many users skipped (left empty)
  dropOffs: number; // How many users abandoned at this field
  
  // Rates
  fillRate: number;
  skipRate: number;
  dropOffRate: number;
  
  // Time spent
  averageTimeSpent: number; // in seconds
  
  // Errors
  errorCount: number;
  errorRate: number;
  commonErrors: string[];
}

/**
 * Drop-off data for a page (multi-page forms)
 */
export interface PageDropOff {
  pageNumber: number;
  pageTitle: string;
  
  views: number;
  completions: number;
  dropOffs: number;
  dropOffRate: number;
  
  averageTimeOnPage: number;
}

/**
 * Identified drop-off pattern
 */
export interface DropOffPattern {
  id: string;
  type: 'sequential' | 'field_specific' | 'time_based' | 'device_specific';
  description: string;
  affectedFields: string[];
  severity: 'low' | 'medium' | 'high';
  occurrence: number;
  percentage: number;
}

/**
 * Recommendation for reducing drop-off
 */
export interface DropOffRecommendation {
  id: string;
  fieldId?: string;
  type: 'simplify' | 'make_optional' | 'add_help' | 'fix_validation' | 'reorder' | 'remove';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number; // 1-10, higher = more important
}

// ============================================================================
// FIELD ANALYTICS
// ============================================================================

/**
 * Analytics for individual fields
 */
export interface FieldAnalytics {
  fieldId: string;
  fieldName: string;
  fieldType: string;
  
  // Fill metrics
  fillRate: number;
  averageTime: number;
  
  // Error metrics
  errorRate: number;
  commonErrors: ErrorPattern[];
  
  // Value distribution (for choice fields)
  valueDistribution?: ValueDistribution[];
  
  // Text analysis (for text fields)
  textAnalysis?: TextAnalysis;
  
  // Number analysis (for number fields)
  numberAnalysis?: NumberAnalysis;
}

/**
 * Error pattern for a field
 */
export interface ErrorPattern {
  errorType: string;
  message: string;
  count: number;
  percentage: number;
}

/**
 * Value distribution for choice fields
 */
export interface ValueDistribution {
  value: string;
  label: string;
  count: number;
  percentage: number;
}

/**
 * Text analysis for text fields
 */
export interface TextAnalysis {
  totalResponses: number;
  averageLength: number;
  minLength: number;
  maxLength: number;
  wordCount: {
    average: number;
    min: number;
    max: number;
  };
  topWords: Array<{
    word: string;
    count: number;
  }>;
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

/**
 * Number analysis for numeric fields
 */
export interface NumberAnalysis {
  totalResponses: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  distribution: NumberDistribution[];
}

/**
 * Number distribution bucket
 */
export interface NumberDistribution {
  range: {
    min: number;
    max: number;
  };
  count: number;
  percentage: number;
}

// ============================================================================
// RESPONSE ANALYTICS
// ============================================================================

/**
 * Analytics for form responses/submissions
 */
export interface ResponseAnalytics {
  formId: string;
  
  // Summary statistics
  totalResponses: number;
  fieldSummaries: FieldSummary[];
  
  // Time-based analysis
  submissionsByTime: TimeSeriesData[];
  
  // Cross-tabulation
  crossTabs?: CrossTabulation[];
  
  // Correlation analysis
  correlations?: FieldCorrelation[];
}

/**
 * Summary for a single field
 */
export type FieldSummary =
  | { type: 'text'; data: TextAnalysis }
  | { type: 'number'; data: NumberAnalysis }
  | { type: 'choice'; data: ValueDistribution[] }
  | { type: 'date'; data: DateAnalysis }
  | { type: 'rating'; data: RatingAnalysis }
  | { type: 'boolean'; data: BooleanAnalysis };

/**
 * Date field analysis
 */
export interface DateAnalysis {
  totalResponses: number;
  earliest: Date;
  latest: Date;
  distribution: Array<{
    date: string;
    count: number;
  }>;
  dayOfWeek: Array<{
    day: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Rating field analysis
 */
export interface RatingAnalysis {
  totalResponses: number;
  average: number;
  median: number;
  distribution: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  npsScore?: number; // If NPS-style (0-10)
}

/**
 * Boolean field analysis
 */
export interface BooleanAnalysis {
  totalResponses: number;
  trueCount: number;
  falseCount: number;
  truePercentage: number;
  falsePercentage: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesData {
  date: string;
  count: number;
  cumulative?: number;
}

/**
 * Cross-tabulation between two fields
 */
export interface CrossTabulation {
  field1: string;
  field2: string;
  matrix: Record<string, Record<string, number>>;
  chiSquare?: number;
  pValue?: number;
}

/**
 * Correlation between two fields
 */
export interface FieldCorrelation {
  field1: string;
  field2: string;
  correlationCoefficient: number;
  significance: 'significant' | 'not_significant';
}

// ============================================================================
// SUBMISSION TRENDS
// ============================================================================

/**
 * Submission trends over time
 */
export interface SubmissionTrends {
  formId: string;
  
  // Daily submissions
  daily: TimeSeriesData[];
  
  // Weekly submissions
  weekly: TimeSeriesData[];
  
  // Monthly submissions
  monthly: TimeSeriesData[];
  
  // Hourly distribution
  hourlyDistribution: Array<{
    hour: number;
    count: number;
    percentage: number;
  }>;
  
  // Day of week distribution
  dayOfWeekDistribution: Array<{
    day: string;
    count: number;
    percentage: number;
  }>;
  
  // Trends
  trends: {
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
  };
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Analytics export options
 */
export interface AnalyticsExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  includeCharts: boolean;
  includeRawData: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sections: {
    completionMetrics: boolean;
    dropOffAnalysis: boolean;
    fieldAnalytics: boolean;
    responseAnalytics: boolean;
    trends: boolean;
  };
}

/**
 * Analytics report
 */
export interface AnalyticsReport {
  id: string;
  formId: string;
  formName: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  
  completionMetrics: FormCompletionMetrics;
  dropOffAnalysis: DropOffAnalysis;
  fieldAnalytics: FieldAnalytics[];
  responseAnalytics: ResponseAnalytics;
  trends: SubmissionTrends;
  
  // Summary
  summary: {
    keyFindings: string[];
    recommendations: string[];
    score: number; // Overall form health score (0-100)
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate completion rate
 */
export function calculateCompletionRate(starts: number, completions: number): number {
  if (starts === 0) return 0;
  return Math.round((completions / starts) * 100);
}

/**
 * Calculate drop-off rate
 */
export function calculateDropOffRate(views: number, dropOffs: number): number {
  if (views === 0) return 0;
  return Math.round((dropOffs / views) * 100);
}

/**
 * Calculate average from array of numbers
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate median from array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = calculateAverage(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate percentile
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get default analytics report structure
 */
export function getDefaultAnalyticsReport(formId: string, formName: string): AnalyticsReport {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    id: `report_${Date.now()}`,
    formId,
    formName,
    generatedAt: now,
    period: {
      start: thirtyDaysAgo,
      end: now,
    },
    completionMetrics: {
      formId,
      formName,
      totalViews: 0,
      uniqueViews: 0,
      totalStarts: 0,
      startRate: 0,
      totalCompletions: 0,
      completionRate: 0,
      averageCompletionTime: 0,
      medianCompletionTime: 0,
      minCompletionTime: 0,
      maxCompletionTime: 0,
      deviceBreakdown: {
        desktop: 0,
        mobile: 0,
        tablet: 0,
        other: 0,
      },
      period: {
        start: thirtyDaysAgo,
        end: now,
      },
    },
    dropOffAnalysis: {
      formId,
      overallDropOffRate: 0,
      fieldDropOffs: [],
      patterns: [],
      recommendations: [],
    },
    fieldAnalytics: [],
    responseAnalytics: {
      formId,
      totalResponses: 0,
      fieldSummaries: [],
      submissionsByTime: [],
    },
    trends: {
      formId,
      daily: [],
      weekly: [],
      monthly: [],
      hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: 0,
        percentage: 0,
      })),
      dayOfWeekDistribution: [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
      ].map((day) => ({
        day,
        count: 0,
        percentage: 0,
      })),
      trends: {
        dailyChange: 0,
        weeklyChange: 0,
        monthlyChange: 0,
      },
    },
    summary: {
      keyFindings: [],
      recommendations: [],
      score: 0,
    },
  };
}

export default AnalyticsReport;