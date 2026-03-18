'use client';

import { useCallback, useState, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Edit,
  Move,
  AlertTriangle,
  Info,
  Check,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { DetectedChange, ChangeType, ImpactLevel } from '@/lib/documents/ai-prompts';
import type { ChangeReport, FieldMappingSuggestion } from '@/lib/documents/ai-change-detection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Comparison stage
 */
type ComparisonStage = 
  | 'idle'
  | 'uploading_original'
  | 'uploading_new'
  | 'analyzing'
  | 'comparing'
  | 'complete'
  | 'error';

/**
 * Comparison progress
 */
interface ComparisonProgress {
  stage: ComparisonStage;
  message: string;
  progress: number;
}

/**
 * Props for ChangeDetector component
 */
interface ChangeDetectorProps {
  /** Called when changes are accepted and template is updated */
  onChangesAccepted?: (changes: DetectedChange[]) => void;
  /** Called when comparison completes */
  onComparisonComplete?: (report: ChangeReport) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Original PDF URL (if already uploaded) */
  originalPdfUrl?: string;
  /** Whether the detector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// CHANGE TYPE CONFIG
// ============================================================================

const CHANGE_TYPE_CONFIG: Record<ChangeType, { icon: typeof Plus; color: string; bgColor: string; label: string }> = {
  added: { icon: Plus, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900', label: 'Added' },
  removed: { icon: Minus, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900', label: 'Removed' },
  modified: { icon: Edit, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900', label: 'Modified' },
  moved: { icon: Move, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900', label: 'Moved' },
};

const IMPACT_CONFIG: Record<ImpactLevel, { color: string; bgColor: string; label: string }> = {
  breaking: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900', label: 'Breaking' },
  'non-breaking': { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900', label: 'Non-Breaking' },
  neutral: { color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900', label: 'Neutral' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ChangeDetector({
  onChangesAccepted,
  onComparisonComplete,
  onError,
  originalPdfUrl,
  disabled = false,
  className,
}: ChangeDetectorProps) {
  // State
  const [progress, setProgress] = useState<ComparisonProgress>({
    stage: 'idle',
    message: '',
    progress: 0,
  });
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [changeReport, setChangeReport] = useState<ChangeReport | null>(null);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('all');

  const originalInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (file: File, type: 'original' | 'new') => {
      if (disabled) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        onError?.('Please select a PDF file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        onError?.('File size must be less than 10MB');
        return;
      }

      if (type === 'original') {
        setOriginalFile(file);
      } else {
        setNewFile(file);
      }
    },
    [disabled, onError]
  );

  /**
   * Start comparison
   */
  const startComparison = async () => {
    if (!originalFile || !newFile) return;

    setProgress({ stage: 'uploading_original', message: 'Processing original PDF...', progress: 10 });

    try {
      // Simulate comparison stages
      await delay(500);
      setProgress({ stage: 'uploading_new', message: 'Processing new PDF...', progress: 30 });

      await delay(500);
      setProgress({ stage: 'analyzing', message: 'Analyzing document structures...', progress: 50 });

      await delay(500);
      setProgress({ stage: 'comparing', message: 'Comparing documents with AI...', progress: 70 });

      await delay(1000);

      // Mock change report for demo
      const mockReport: ChangeReport = {
        summary: {
          totalChanges: 8,
          added: 2,
          removed: 1,
          modified: 4,
          moved: 1,
          breaking: 2,
          nonBreaking: 5,
        },
        byImpact: {
          breaking: generateMockChangesByImpact('breaking', 2),
          nonBreaking: generateMockChangesByImpact('non-breaking', 5),
          neutral: generateMockChangesByImpact('neutral', 1),
        },
        byType: {
          added: generateMockChangesByType('added', 2),
          removed: generateMockChangesByType('removed', 1),
          modified: generateMockChangesByType('modified', 4),
          moved: generateMockChangesByType('moved', 1),
        },
        mappingSuggestions: generateMockMappings(),
        recommendations: [
          '⚠️ 2 breaking change(s) detected. Review and update form schema before deploying.',
          'Required fields were removed. Consider data migration for existing submissions.',
          'Template update required. Create a new version and notify assigned users.',
        ],
        requiresUpdate: true,
      };

      setChangeReport(mockReport);
      setProgress({ stage: 'complete', message: 'Comparison complete!', progress: 100 });
      onComparisonComplete?.(mockReport);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Comparison failed';
      setProgress({ stage: 'error', message, progress: 0 });
      onError?.(message);
    }
  };

  /**
   * Accept a change
   */
  const acceptChange = (changeId: string) => {
    setAcceptedChanges((prev) => new Set([...prev, changeId]));
  };

  /**
   * Reject a change
   */
  const rejectChange = (changeId: string) => {
    setAcceptedChanges((prev) => {
      const next = new Set(prev);
      next.delete(changeId);
      return next;
    });
  };

  /**
   * Accept all changes
   */
  const acceptAllChanges = () => {
    if (!changeReport) return;
    const allIds = changeReport.byType.added
      .concat(changeReport.byType.modified)
      .concat(changeReport.byType.moved)
      .map((c) => c.id);
    setAcceptedChanges(new Set(allIds));
  };

  /**
   * Apply accepted changes
   */
  const applyChanges = () => {
    if (!changeReport) return;
    const accepted = changeReport.byType.added
      .concat(changeReport.byType.modified)
      .concat(changeReport.byType.moved)
      .filter((c) => acceptedChanges.has(c.id));
    onChangesAccepted?.(accepted);
  };

  /**
   * Reset detector
   */
  const reset = () => {
    setOriginalFile(null);
    setNewFile(null);
    setChangeReport(null);
    setAcceptedChanges(new Set());
    setProgress({ stage: 'idle', message: '', progress: 0 });
    if (originalInputRef.current) originalInputRef.current.value = '';
    if (newInputRef.current) newInputRef.current.value = '';
  };

  const isComparing = ['uploading_original', 'uploading_new', 'analyzing', 'comparing'].includes(
    progress.stage
  );

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Change Detection
          </h3>
          <p className="text-sm text-muted-foreground">
            Compare two PDF versions to detect changes
          </p>
        </div>
      </div>

      {/* Upload Area (shown when idle) */}
      {progress.stage === 'idle' && !changeReport && (
        <div className="space-y-4">
          {/* Original PDF */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Original Version</CardTitle>
              <CardDescription>Upload the original PDF document</CardDescription>
            </CardHeader>
            <CardContent>
              {!originalFile ? (
                <div
                  onClick={() => !disabled && originalInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
                    'flex flex-col items-center justify-center',
                    'hover:border-primary/50 hover:bg-muted/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    ref={originalInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file, 'original');
                    }}
                    disabled={disabled}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Upload Original PDF</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{originalFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(originalFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOriginalFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* New PDF */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">New Version</CardTitle>
              <CardDescription>Upload the updated PDF document</CardDescription>
            </CardHeader>
            <CardContent>
              {!newFile ? (
                <div
                  onClick={() => !disabled && newInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
                    'flex flex-col items-center justify-center',
                    'hover:border-primary/50 hover:bg-muted/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    ref={newInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file, 'new');
                    }}
                    disabled={disabled}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Upload New PDF</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{newFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(newFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setNewFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compare Button */}
          <Button
            onClick={startComparison}
            disabled={!originalFile || !newFile || disabled}
            className="w-full"
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Documents
          </Button>
        </div>
      )}

      {/* Progress Display */}
      {isComparing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">{progress.message}</p>
                <Progress value={progress.progress} className="mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {progress.stage === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Comparison Failed</AlertTitle>
          <AlertDescription>{progress.message}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {progress.stage === 'complete' && changeReport && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{changeReport.summary.totalChanges}</div>
                <div className="text-sm text-muted-foreground">Total Changes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{changeReport.summary.added}</div>
                <div className="text-sm text-muted-foreground">Added</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{changeReport.summary.removed}</div>
                <div className="text-sm text-muted-foreground">Removed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{changeReport.summary.modified}</div>
                <div className="text-sm text-muted-foreground">Modified</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{changeReport.summary.breaking}</div>
                <div className="text-sm text-muted-foreground">Breaking</div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {changeReport.recommendations.length > 0 && (
            <Alert variant={changeReport.requiresUpdate ? 'destructive' : 'default'}>
              {changeReport.requiresUpdate ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertTitle>Recommendations</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {changeReport.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={acceptAllChanges}>
                <Check className="h-4 w-4 mr-1" />
                Accept All
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
          </div>

          {/* Changes Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Changes</TabsTrigger>
              <TabsTrigger value="breaking">Breaking</TabsTrigger>
              <TabsTrigger value="byType">By Type</TabsTrigger>
              <TabsTrigger value="mappings">Mappings</TabsTrigger>
            </TabsList>

            {/* All Changes */}
            <TabsContent value="all">
              <Card>
                <CardContent className="pt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {changeReport.byType.added
                        .concat(changeReport.byType.modified)
                        .concat(changeReport.byType.removed)
                        .concat(changeReport.byType.moved)
                        .map((change) => (
                          <ChangeItem
                            key={change.id}
                            change={change}
                            accepted={acceptedChanges.has(change.id)}
                            onAccept={() => acceptChange(change.id)}
                            onReject={() => rejectChange(change.id)}
                          />
                        ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Breaking Changes */}
            <TabsContent value="breaking">
              <Card>
                <CardContent className="pt-4">
                  <ScrollArea className="h-[400px]">
                    {changeReport.byImpact.breaking.length > 0 ? (
                      <div className="space-y-2">
                        {changeReport.byImpact.breaking.map((change) => (
                          <ChangeItem
                            key={change.id}
                            change={change}
                            accepted={acceptedChanges.has(change.id)}
                            onAccept={() => acceptChange(change.id)}
                            onReject={() => rejectChange(change.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mb-2 text-green-600" />
                        <p>No breaking changes detected</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* By Type */}
            <TabsContent value="byType">
              <Accordion type="multiple" defaultValue={['added', 'modified', 'removed']}>
                <AccordionItem value="added">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className={CHANGE_TYPE_CONFIG.added.bgColor}>
                        <Plus className="h-3 w-3 mr-1" />
                        Added
                      </Badge>
                      <span>{changeReport.byType.added.length}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {changeReport.byType.added.map((change) => (
                        <ChangeItem
                          key={change.id}
                          change={change}
                          accepted={acceptedChanges.has(change.id)}
                          onAccept={() => acceptChange(change.id)}
                          onReject={() => rejectChange(change.id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="modified">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className={CHANGE_TYPE_CONFIG.modified.bgColor}>
                        <Edit className="h-3 w-3 mr-1" />
                        Modified
                      </Badge>
                      <span>{changeReport.byType.modified.length}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {changeReport.byType.modified.map((change) => (
                        <ChangeItem
                          key={change.id}
                          change={change}
                          accepted={acceptedChanges.has(change.id)}
                          onAccept={() => acceptChange(change.id)}
                          onReject={() => rejectChange(change.id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="removed">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className={CHANGE_TYPE_CONFIG.removed.bgColor}>
                        <Minus className="h-3 w-3 mr-1" />
                        Removed
                      </Badge>
                      <span>{changeReport.byType.removed.length}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {changeReport.byType.removed.map((change) => (
                        <ChangeItem
                          key={change.id}
                          change={change}
                          accepted={acceptedChanges.has(change.id)}
                          onAccept={() => acceptChange(change.id)}
                          onReject={() => rejectChange(change.id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="moved">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className={CHANGE_TYPE_CONFIG.moved.bgColor}>
                        <Move className="h-3 w-3 mr-1" />
                        Moved
                      </Badge>
                      <span>{changeReport.byType.moved.length}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {changeReport.byType.moved.map((change) => (
                        <ChangeItem
                          key={change.id}
                          change={change}
                          accepted={acceptedChanges.has(change.id)}
                          onAccept={() => acceptChange(change.id)}
                          onReject={() => rejectChange(change.id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            {/* Field Mappings */}
            <TabsContent value="mappings">
              <Card>
                <CardContent className="pt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {changeReport.mappingSuggestions.map((mapping, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{mapping.originalFieldId || 'New Field'}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{mapping.newFieldId || 'Remove'}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{mapping.reason}</p>
                          </div>
                          <Badge
                            className={cn(
                              mapping.action === 'map' && 'bg-green-100 text-green-700',
                              mapping.action === 'remove' && 'bg-red-100 text-red-700',
                              mapping.action === 'add' && 'bg-blue-100 text-blue-700',
                              mapping.action === 'manual' && 'bg-orange-100 text-orange-700'
                            )}
                          >
                            {mapping.action}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Apply Changes Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={applyChanges} disabled={acceptedChanges.size === 0}>
              Apply {acceptedChanges.size} Accepted Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHANGE ITEM COMPONENT
// ============================================================================

interface ChangeItemProps {
  change: DetectedChange;
  accepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}

function ChangeItem({ change, accepted, onAccept, onReject }: ChangeItemProps) {
  const typeConfig = CHANGE_TYPE_CONFIG[change.changeType];
  const impactConfig = IMPACT_CONFIG[change.impact];
  const TypeIcon = typeConfig.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        accepted && 'border-green-500 bg-green-50 dark:bg-green-950'
      )}
    >
      <div className={cn('p-2 rounded-lg', typeConfig.bgColor)}>
        <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{change.field?.label || 'Unknown Field'}</span>
          <Badge variant="outline" className={cn('text-xs', impactConfig.bgColor, impactConfig.color)}>
            {impactConfig.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{change.description}</p>
        {change.recommendation && (
          <p className="text-xs text-blue-600 mt-1">{change.recommendation}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!accepted ? (
          <Button variant="ghost" size="icon" onClick={onAccept}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={onReject}>
            <XCircle className="h-4 w-4 text-red-600" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockChangesByType(type: ChangeType, count: number): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const impacts: ImpactLevel[] = ['breaking', 'non-breaking', 'neutral'];

  for (let i = 0; i < count; i++) {
    const impact = impacts[i % impacts.length];
    changes.push({
      id: `change_${type}_${i}`,
      changeType: type,
      field: {
        id: `field_${i}`,
        label: `Field ${i + 1}`,
        type: 'text',
      },
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} field with ${impact} impact`,
      impact,
      recommendation: 'Review and update as needed',
    });
  }

  return changes;
}

function generateMockChangesByImpact(impact: ImpactLevel, count: number): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const types: ChangeType[] = ['added', 'modified', 'removed', 'moved'];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    changes.push({
      id: `change_${impact}_${i}`,
      changeType: type,
      field: {
        id: `field_${i}`,
        label: `Field ${i + 1}`,
        type: 'text',
      },
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} field with ${impact} impact`,
      impact,
      recommendation: 'Review and update as needed',
    });
  }

  return changes;
}

function generateMockMappings(): FieldMappingSuggestion[] {
  return [
    {
      originalFieldId: 'field_1',
      newFieldId: 'field_1',
      confidence: 0.95,
      reason: 'Exact match found',
      action: 'map',
    },
    {
      originalFieldId: 'field_2',
      newFieldId: 'field_2_new',
      confidence: 0.85,
      reason: 'Similar label and type',
      action: 'map',
    },
    {
      originalFieldId: 'field_3',
      newFieldId: null,
      confidence: 0.9,
      reason: 'No matching field found in new version',
      action: 'remove',
    },
    {
      originalFieldId: '',
      newFieldId: 'field_new_1',
      confidence: 0.9,
      reason: 'New field with no corresponding field in original',
      action: 'add',
    },
  ];
}

export default ChangeDetector;