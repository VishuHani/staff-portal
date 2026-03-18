'use client';

import { useCallback, useState, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wand2,
  Eye,
  EyeOff,
  Check,
  XCircle,
  Edit2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AIDetectedField, FieldDetectionResult, DocumentStructureAnalysis } from '@/lib/documents/ai-prompts';
import type { FormSchema, FieldType } from '@/lib/types/form-schema';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Detection stage
 */
type DetectionStage = 
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'analyzing_structure'
  | 'detecting_fields'
  | 'complete'
  | 'error';

/**
 * Detection progress
 */
interface DetectionProgress {
  stage: DetectionStage;
  message: string;
  progress: number;
}

/**
 * Field with approval status
 */
interface FieldWithStatus extends AIDetectedField {
  approved: boolean;
  edited: boolean;
  originalLabel: string;
  originalType: string;
}

/**
 * Props for AIFieldDetector component
 */
interface AIFieldDetectorProps {
  /** Called when fields are approved and form is generated */
  onFormGenerated?: (schema: FormSchema) => void;
  /** Called when detection completes */
  onDetectionComplete?: (result: FieldDetectionResult) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Venue ID for storage */
  venueId: string;
  /** Whether the detector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Pre-uploaded PDF URL to analyze */
  pdfUrl?: string;
  /** Pre-loaded PDF data */
  pdfData?: ArrayBuffer;
}

// ============================================================================
// FIELD TYPE ICONS AND COLORS
// ============================================================================

const FIELD_TYPE_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  text: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900', label: 'Text' },
  textarea: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900', label: 'Text Area' },
  number: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900', label: 'Number' },
  email: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900', label: 'Email' },
  phone: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900', label: 'Phone' },
  date: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900', label: 'Date' },
  time: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900', label: 'Time' },
  checkbox: { color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900', label: 'Checkbox' },
  signature: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900', label: 'Signature' },
  select: { color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900', label: 'Dropdown' },
  radio: { color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900', label: 'Radio' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIFieldDetector({
  onFormGenerated,
  onDetectionComplete,
  onError,
  venueId,
  disabled = false,
  className,
  pdfUrl,
  pdfData,
}: AIFieldDetectorProps) {
  // State
  const [progress, setProgress] = useState<DetectionProgress>({
    stage: 'idle',
    message: '',
    progress: 0,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionResult, setDetectionResult] = useState<FieldDetectionResult | null>(null);
  const [structureInfo, setStructureInfo] = useState<DocumentStructureAnalysis | null>(null);
  const [fields, setFields] = useState<FieldWithStatus[]>([]);
  const [editingField, setEditingField] = useState<FieldWithStatus | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check AI availability on mount
  useState(() => {
    // This would be an async check in a real implementation
    setAiAvailable(true);
  });

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((file: File) => {
    if (disabled) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onError?.('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onError?.('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    startDetection(file);
  }, [disabled, onError]);

  /**
   * Start AI detection process
   */
  const startDetection = async (file: File) => {
    setProgress({ stage: 'uploading', message: 'Reading PDF...', progress: 5 });

    try {
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Simulate detection stages (in real implementation, call server actions)
      setProgress({ stage: 'extracting', message: 'Extracting text content...', progress: 20 });
      await delay(500);

      setProgress({ stage: 'analyzing_structure', message: 'Analyzing document structure...', progress: 40 });
      await delay(500);

      setProgress({ stage: 'detecting_fields', message: 'Detecting input fields with AI...', progress: 70 });
      await delay(1000);

      // Mock detection result for demo
      const mockResult: FieldDetectionResult = {
        fields: generateMockFields(),
        existingFields: [],
        signatureAreas: [],
        tables: [],
        dateFields: [],
        checkboxGroups: [],
        overallConfidence: 0.85,
      };

      const mockStructure: DocumentStructureAnalysis = {
        documentType: 'form',
        title: file.name.replace('.pdf', ''),
        purpose: 'Employment application form',
        sections: [
          { title: 'Personal Information', pageNumber: 1, startY: 0, fieldCount: 4 },
          { title: 'Contact Details', pageNumber: 1, startY: 30, fieldCount: 3 },
          { title: 'Emergency Contact', pageNumber: 1, startY: 60, fieldCount: 2 },
        ],
        complianceIndicators: ['signature required'],
        hasFillableFields: false,
        requiresSignature: true,
        confidence: 0.9,
      };

      // Set results
      setDetectionResult(mockResult);
      setStructureInfo(mockStructure);
      setFields(
        mockResult.fields.map((f) => ({
          ...f,
          approved: f.confidence >= 0.7,
          edited: false,
          originalLabel: f.label,
          originalType: f.type,
        }))
      );

      setProgress({ stage: 'complete', message: 'Detection complete!', progress: 100 });
      onDetectionComplete?.(mockResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed';
      setProgress({ stage: 'error', message, progress: 0 });
      onError?.(message);
    }
  };

  /**
   * Approve a field
   */
  const approveField = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, approved: true } : f))
    );
  };

  /**
   * Reject a field
   */
  const rejectField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  /**
   * Update field after editing
   */
  const updateField = (updatedField: FieldWithStatus) => {
    setFields((prev) =>
      prev.map((f) =>
        f.id === updatedField.id
          ? { ...updatedField, edited: updatedField.label !== f.originalLabel || updatedField.type !== f.originalType }
          : f
      )
    );
    setEditingField(null);
  };

  /**
   * Approve all high-confidence fields
   */
  const approveAllHighConfidence = () => {
    setFields((prev) =>
      prev.map((f) => ({
        ...f,
        approved: f.confidence >= 0.7 ? true : f.approved,
      }))
    );
  };

  /**
   * Generate form from approved fields
   */
  const generateForm = () => {
    const approvedFields = fields.filter((f) => f.approved);
    
    // Create form schema
    const schema: FormSchema = {
      id: `form_${Date.now()}`,
      version: 1,
      name: structureInfo?.title || 'Generated Form',
      description: structureInfo?.purpose,
      fields: approvedFields.map((f) => ({
        id: f.id,
        type: f.type as FieldType,
        label: f.label,
        required: f.required,
        placeholder: f.placeholder,
        validation: f.validation?.map((v) => ({
          type: v.type as any,
          message: v.message || `Invalid value for ${f.label}`,
        })),
        options: f.options?.map((opt) => ({
          value: opt.toLowerCase().replace(/\s+/g, '_'),
          label: opt,
        })),
      })),
      settings: {
        layout: 'single',
        showProgress: true,
        allowSave: true,
        autoSave: true,
      },
    };

    onFormGenerated?.(schema);
  };

  /**
   * Reset detector
   */
  const reset = () => {
    setSelectedFile(null);
    setDetectionResult(null);
    setStructureInfo(null);
    setFields([]);
    setProgress({ stage: 'idle', message: '', progress: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate stats
  const stats = {
    total: fields.length,
    approved: fields.filter((f) => f.approved).length,
    highConfidence: fields.filter((f) => f.confidence >= 0.8).length,
    lowConfidence: fields.filter((f) => f.confidence < 0.6).length,
    required: fields.filter((f) => f.required).length,
    signatures: fields.filter((f) => f.type === 'signature').length,
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Field Detection
          </h3>
          <p className="text-sm text-muted-foreground">
            Upload a PDF and let AI detect input fields automatically
          </p>
        </div>
        {aiAvailable === false && (
          <Badge variant="destructive">AI Unavailable</Badge>
        )}
        {aiAvailable === true && (
          <Badge variant="default" className="bg-green-600">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Ready
          </Badge>
        )}
      </div>

      {/* Upload Area (shown when idle) */}
      {progress.stage === 'idle' && !selectedFile && (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer',
            'flex flex-col items-center justify-center min-h-[200px]',
            'hover:border-primary/50 hover:bg-muted/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            disabled={disabled}
            className="hidden"
          />
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Upload PDF for AI Analysis</p>
          <p className="text-sm text-muted-foreground">
            Drag & drop or click to browse
          </p>
        </div>
      )}

      {/* Progress Display */}
      {progress.stage !== 'idle' && progress.stage !== 'complete' && (
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
          <AlertTitle>Detection Failed</AlertTitle>
          <AlertDescription>{progress.message}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {progress.stage === 'complete' && detectionResult && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Fields Detected</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{stats.highConfidence}</div>
                <div className="text-sm text-muted-foreground">High Confidence</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{stats.lowConfidence}</div>
                <div className="text-sm text-muted-foreground">Needs Review</div>
              </CardContent>
            </Card>
          </div>

          {/* Document Info */}
          {structureInfo && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Document Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{structureInfo.documentType}</Badge>
                  {structureInfo.requiresSignature && (
                    <Badge variant="secondary">Signature Required</Badge>
                  )}
                  <Badge variant="outline">
                    {(detectionResult.overallConfidence * 100).toFixed(0)}% Confidence
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={approveAllHighConfidence}>
                <Check className="h-4 w-4 mr-1" />
                Approve High Confidence
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
          </div>

          {/* Fields List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detected Fields</CardTitle>
              <CardDescription>
                Review and approve detected fields. Low confidence fields need manual review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {fields.map((field) => {
                    const config = FIELD_TYPE_CONFIG[field.type] || FIELD_TYPE_CONFIG.text;
                    const needsReview = field.confidence < 0.7;

                    return (
                      <div
                        key={field.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border',
                          field.approved && 'border-green-500 bg-green-50 dark:bg-green-950',
                          needsReview && !field.approved && 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                        )}
                      >
                        {/* Type Badge */}
                        <Badge className={cn(config.bgColor, config.color)}>
                          {config.label}
                        </Badge>

                        {/* Field Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{field.label}</span>
                            {field.required && (
                              <span className="text-red-500">*</span>
                            )}
                            {field.edited && (
                              <Badge variant="outline" className="text-xs">Edited</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Page {field.position.pageNumber}</span>
                            <span>•</span>
                            <span className={cn(
                              field.confidence >= 0.8 && 'text-green-600',
                              field.confidence < 0.6 && 'text-red-600',
                              field.confidence >= 0.6 && field.confidence < 0.8 && 'text-orange-600'
                            )}>
                              {(field.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingField(field)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {!field.approved ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => approveField(field.id)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => rejectField(field.id)}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Generate Form Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={generateForm} disabled={stats.approved === 0}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Form ({stats.approved} fields)
            </Button>
          </div>
        </div>
      )}

      {/* Field Edit Dialog */}
      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>
              Adjust the field properties before approving
            </DialogDescription>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={editingField.label}
                  onChange={(e) =>
                    setEditingField({ ...editingField, label: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="type">Field Type</Label>
                <Select
                  value={editingField.type}
                  onValueChange={(value) =>
                    setEditingField({ ...editingField, type: value as AIDetectedField['type'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="textarea">Text Area</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="time">Time</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="signature">Signature</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="radio">Radio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="required"
                  checked={editingField.required}
                  onCheckedChange={(checked) =>
                    setEditingField({ ...editingField, required: checked })
                  }
                />
                <Label htmlFor="required">Required Field</Label>
              </div>
              <div>
                <Label htmlFor="placeholder">Placeholder (optional)</Label>
                <Input
                  id="placeholder"
                  value={editingField.placeholder || ''}
                  onChange={(e) =>
                    setEditingField({ ...editingField, placeholder: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>
              Cancel
            </Button>
            <Button onClick={() => editingField && updateField(editingField)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockFields(): AIDetectedField[] {
  return [
    {
      id: 'field_1',
      label: 'Full Name',
      type: 'text',
      position: { pageNumber: 1, x: 10, y: 10, width: 80, height: 5 },
      confidence: 0.95,
      required: true,
    },
    {
      id: 'field_2',
      label: 'Email Address',
      type: 'email',
      position: { pageNumber: 1, x: 10, y: 16, width: 80, height: 5 },
      confidence: 0.92,
      required: true,
    },
    {
      id: 'field_3',
      label: 'Phone Number',
      type: 'phone',
      position: { pageNumber: 1, x: 10, y: 22, width: 80, height: 5 },
      confidence: 0.88,
      required: true,
    },
    {
      id: 'field_4',
      label: 'Date of Birth',
      type: 'date',
      position: { pageNumber: 1, x: 10, y: 28, width: 40, height: 5 },
      confidence: 0.85,
      required: false,
    },
    {
      id: 'field_5',
      label: 'Address',
      type: 'textarea',
      position: { pageNumber: 1, x: 10, y: 34, width: 80, height: 10 },
      confidence: 0.82,
      required: true,
    },
    {
      id: 'field_6',
      label: 'Emergency Contact Name',
      type: 'text',
      position: { pageNumber: 1, x: 10, y: 50, width: 80, height: 5 },
      confidence: 0.78,
      required: true,
    },
    {
      id: 'field_7',
      label: 'Emergency Contact Phone',
      type: 'phone',
      position: { pageNumber: 1, x: 10, y: 56, width: 80, height: 5 },
      confidence: 0.75,
      required: true,
    },
    {
      id: 'field_8',
      label: 'Signature',
      type: 'signature',
      position: { pageNumber: 1, x: 10, y: 80, width: 40, height: 10 },
      confidence: 0.90,
      required: true,
    },
    {
      id: 'field_9',
      label: 'Date',
      type: 'date',
      position: { pageNumber: 1, x: 55, y: 85, width: 25, height: 5 },
      confidence: 0.65,
      required: true,
    },
    {
      id: 'field_10',
      label: 'Terms and Conditions',
      type: 'checkbox',
      position: { pageNumber: 1, x: 10, y: 92, width: 5, height: 3 },
      confidence: 0.55,
      required: true,
    },
  ];
}

export default AIFieldDetector;