'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Settings, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, FileText, Download, Printer, Upload, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormRenderer } from '@/components/documents/form-renderer/FormRenderer';
import { DevicePreviewFrame } from '@/components/documents/form-preview/DevicePreviewFrame';
import { FormTestPanel } from '@/components/documents/form-preview/FormTestPanel';
import { ThemePreviewSelector } from '@/components/documents/form-preview/ThemePreviewSelector';
import { TestDataSimulator } from '@/components/documents/form-preview/TestDataSimulator';
import { FormSchema, FormData, FormField } from '@/lib/types/form-schema';
import { DEFAULT_THEME, FormTheme } from '@/lib/types/form-theme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getDocumentTemplate } from '@/lib/actions/documents/templates';
import { toast } from 'sonner';

// ============================================================================
// TEMPLATE TYPE FOR PDF DOCUMENTS
// ============================================================================

interface PDFTemplate {
  id: string;
  name: string;
  description: string | null;
  pdfUrl: string | null;
  pdfFileName: string | null;
  pdfFileSize: number | null;
  documentType: string;
  isPrintOnly: boolean;
  instructions: string | null;
  printInstructions: string | null;
  requireSignature: boolean;
  allowDownload: boolean;
  formSchema: Record<string, unknown> | null;
}

// ============================================================================
// PREVIEW SETTINGS INTERFACE
// ============================================================================

interface PreviewSettings {
  enableValidations: boolean;
  enableConditionalLogic: boolean;
  testMode: boolean;
}

// ============================================================================
// PDF PREVIEW COMPONENT
// ============================================================================

interface PDFPreviewProps {
  template: PDFTemplate;
  onThemeChange?: (theme: FormTheme) => void;
  theme?: FormTheme;
}

function PDFPreview({ template, theme }: PDFPreviewProps) {
  const [zoom, setZoom] = React.useState(100);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handlePrint = () => {
    if (template.pdfUrl) {
      const printWindow = window.open(template.pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* PDF Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold">{template.name}</h2>
              <p className="text-sm text-muted-foreground">
                {template.pdfFileName || 'PDF Document'} • {formatFileSize(template.pdfFileSize)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-12 text-center">{zoom}%</span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetZoom}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Action Buttons */}
            {template.allowDownload && template.pdfUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={template.pdfUrl} download={template.pdfFileName || 'document.pdf'}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Document Type Badge */}
      <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
            {template.isPrintOnly ? 'Print & Fill Document' : 'PDF Document'}
          </Badge>
          {template.requireSignature && (
            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
              Signature Required
            </Badge>
          )}
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        {template.pdfUrl ? (
          <div 
            className="mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden transition-all duration-200"
            style={{ 
              width: `${zoom}%`,
              minWidth: '300px',
              maxWidth: '100%'
            }}
          >
            <iframe
              src={`${template.pdfUrl}#toolbar=0&navpanes=0`}
              className="w-full h-[calc(100vh-300px)] min-h-[600px]"
              title={template.name}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Card className="max-w-md">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No PDF Available</h3>
                <p className="text-muted-foreground">
                  This document does not have a PDF file attached.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Instructions Panel */}
      {template.instructions && (
        <div className="border-t bg-background p-4">
          <div className="max-w-3xl mx-auto">
            <h4 className="text-sm font-medium mb-2">Instructions</h4>
            <p className="text-sm text-muted-foreground">{template.instructions}</p>
          </div>
        </div>
      )}

      {/* Print Instructions for Print & Fill */}
      {template.isPrintOnly && template.printInstructions && (
        <div className="border-t bg-blue-50 dark:bg-blue-950/30 p-4">
          <div className="max-w-3xl mx-auto">
            <h4 className="text-sm font-medium mb-2 text-blue-800 dark:text-blue-200">
              Print & Fill Instructions
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">{template.printInstructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PREVIEW PAGE COMPONENT
// ============================================================================

export default function FormPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check URL params for initial mode
  const initialMode = searchParams.get('mode');
  const initialTestMode = initialMode === 'test';
  
  const [formData, setFormData] = React.useState<FormData>({});
  const [theme, setTheme] = React.useState<FormTheme>(DEFAULT_THEME);
  const [testMode, setTestMode] = React.useState(initialTestMode);
  const [loading, setLoading] = React.useState(true);
  const [schema, setSchema] = React.useState<FormSchema | null>(null);
  const [pdfTemplate, setPdfTemplate] = React.useState<PDFTemplate | null>(null);
  const [isPdfDocument, setIsPdfDocument] = React.useState(false);
  const [previewSettings, setPreviewSettings] = React.useState<PreviewSettings>({
    enableValidations: true,
    enableConditionalLogic: true,
    testMode: initialTestMode,
  });
  const [validationResults, setValidationResults] = React.useState<{
    isValid: boolean;
    errors: Array<{ fieldId: string; message: string }>;
  } | null>(null);

  // Fetch the actual template from the database
  React.useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const result = await getDocumentTemplate(params.id as string);
        if (result.success && result.data) {
          const template = result.data;
          
          // Check if this is a PDF document (PDF type or Print & Fill)
          const isPdf = template.documentType === 'PDF' || template.isPrintOnly || 
                        (template.pdfUrl && !template.formSchema);
          
          if (isPdf && template.pdfUrl) {
            // This is a PDF document - set PDF template data
            setIsPdfDocument(true);
            setPdfTemplate({
              id: template.id,
              name: template.name,
              description: template.description,
              pdfUrl: template.pdfUrl,
              pdfFileName: template.pdfFileName,
              pdfFileSize: template.pdfFileSize,
              documentType: template.documentType,
              isPrintOnly: template.isPrintOnly,
              instructions: template.instructions,
              printInstructions: template.printInstructions,
              requireSignature: template.requireSignature,
              allowDownload: template.allowDownload,
              formSchema: template.formSchema,
            });
          } else {
            // This is a form document - parse the form schema
            setIsPdfDocument(false);
            let fields: FormField[] = [];
            const rawSchema = template.formSchema;
            
            if (Array.isArray(rawSchema)) {
              fields = rawSchema;
            } else if (rawSchema && typeof rawSchema === 'object' && 'fields' in rawSchema) {
              fields = Array.isArray((rawSchema as Record<string, unknown>).fields) 
                ? (rawSchema as Record<string, unknown>).fields as FormField[] 
                : [];
            }
            
            const formSchema: FormSchema = {
              id: template.id,
              version: 1,
              name: template.name,
              description: template.description || undefined,
              fields,
              settings: {
                layout: 'single',
                showProgress: true,
                allowSave: true,
                autoSave: false,
                submission: {
                  submitLabel: 'Submit',
                  clearOnSubmit: false,
                  requireConfirmation: true,
                  confirmMessage: 'Are you sure you want to submit?',
                },
              },
            };
            setSchema(formSchema);
          }
        } else {
          // Create a sample schema if no template found
          setSchema(createSampleSchema(params.id as string));
          setIsPdfDocument(false);
        }
      } catch (error) {
        console.error('Error fetching template:', error);
        setSchema(createSampleSchema(params.id as string));
        setIsPdfDocument(false);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [params.id]);

  // Handle form data changes
  const handleFormChange = (data: FormData) => {
    setFormData(data);
    setValidationResults(null); // Clear validation on change
  };

  // Handle form submission
  const handleSubmit = async (data: FormData) => {
    if (previewSettings.enableValidations) {
      // Run validation
      const errors = runValidation(schema!, data);
      if (errors.length > 0) {
        setValidationResults({
          isValid: false,
          errors,
        });
        toast.error('Validation failed. Please check the form.');
        return;
      }
    }
    
    console.log('Form submitted (preview mode):', data);
    toast.success('Form submitted successfully! (Preview Mode - No data saved)');
  };

  // Handle test data application
  const handleApplyTestData = (data: FormData) => {
    setFormData(data);
    setValidationResults(null);
  };

  // Handle theme changes
  const handleThemeChange = (newTheme: FormTheme) => {
    setTheme(newTheme);
  };

  // Run validation
  const runValidation = (schema: FormSchema, data: FormData) => {
    const errors: Array<{ fieldId: string; message: string }> = [];
    
    if (!Array.isArray(schema.fields)) {
      return errors;
    }
    
    schema.fields.forEach((field) => {
      if (field.required) {
        const value = data[field.id];
        if (value === undefined || value === null || value === '') {
          errors.push({
            fieldId: field.id,
            message: `${field.label} is required`,
          });
        }
      }
    });
    
    return errors;
  };

  // Run test validation
  const handleRunTest = () => {
    if (!schema) return;
    
    const errors = runValidation(schema, formData);
    setValidationResults({
      isValid: errors.length === 0,
      errors,
    });
    
    if (errors.length === 0) {
      toast.success('All validations passed!');
    } else {
      toast.error(`${errors.length} validation error(s) found`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // PDF Preview Mode
  if (isPdfDocument && pdfTemplate) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-xl font-semibold">{pdfTemplate.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    PDF Preview Mode
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {pdfTemplate.isPrintOnly ? 'Print & Fill' : 'PDF Document'}
                </Badge>
                <Badge variant="secondary">
                  Preview Mode
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Preview Content */}
        <div className="flex-1">
          <PDFPreview template={pdfTemplate} theme={theme} onThemeChange={handleThemeChange} />
        </div>
      </div>
    );
  }

  // No schema state (for form documents)
  if (!schema) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Document Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The requested document could not be loaded.
            </p>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form Preview Mode
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{schema.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Form Preview Mode - No data will be saved
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {/* Validation & Conditional Logic Toggles */}
              <div className="flex items-center gap-2 sm:gap-4 border-r pr-2 sm:pr-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="validations"
                    checked={previewSettings.enableValidations}
                    onCheckedChange={(checked) => 
                      setPreviewSettings(prev => ({ ...prev, enableValidations: checked }))
                    }
                  />
                  <Label htmlFor="validations" className="text-xs sm:text-sm cursor-pointer hidden sm:inline">
                    Validations
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="conditions"
                    checked={previewSettings.enableConditionalLogic}
                    onCheckedChange={(checked) => 
                      setPreviewSettings(prev => ({ ...prev, enableConditionalLogic: checked }))
                    }
                  />
                  <Label htmlFor="conditions" className="text-xs sm:text-sm cursor-pointer hidden sm:inline">
                    Conditions
                  </Label>
                </div>
              </div>
              
              <Badge variant="outline">
                {Array.isArray(schema.fields) ? schema.fields.length : 0} fields
              </Badge>
              <Badge variant={testMode ? 'default' : 'secondary'}>
                {testMode ? 'Test Mode' : 'Preview Mode'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Sidebar - Controls */}
        <div className="w-full lg:w-[400px] xl:w-[450px] border-b lg:border-b-0 lg:border-r bg-background shrink-0">
          <Tabs defaultValue="settings" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 px-2 pt-2">
              <TabsTrigger value="settings" className="text-xs">
                Settings
              </TabsTrigger>
              <TabsTrigger value="theme" className="text-xs">
                Theme
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs">
                Data
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 max-h-[calc(100vh-200px)] lg:max-h-none">
              <TabsContent value="settings" className="p-4 m-0">
                <div className="space-y-4">
                  {/* Test Mode Toggle */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Preview Mode</h3>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        {testMode ? (
                          <ToggleRight className="h-4 w-4 text-primary" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Test Mode</span>
                      </div>
                      <Button
                        variant={testMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTestMode(!testMode)}
                      >
                        {testMode ? 'On' : 'Off'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Test mode shows field status and validation results.
                    </p>
                  </div>

                  <Separator />

                  {/* Validation Settings */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Validation Settings</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm">Enable Validations</span>
                        <Switch
                          checked={previewSettings.enableValidations}
                          onCheckedChange={(checked) => 
                            setPreviewSettings(prev => ({ ...prev, enableValidations: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm">Enable Conditions</span>
                        <Switch
                          checked={previewSettings.enableConditionalLogic}
                          onCheckedChange={(checked) => 
                            setPreviewSettings(prev => ({ ...prev, enableConditionalLogic: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Form Information */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Form Information</h3>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p><strong>ID:</strong> {schema.id}</p>
                      <p><strong>Version:</strong> {schema.version}</p>
                      <p><strong>Fields:</strong> {Array.isArray(schema.fields) ? schema.fields.length : 0}</p>
                      <p><strong>Required:</strong> {Array.isArray(schema.fields) ? schema.fields.filter(f => f.required).length : 0}</p>
                      <p><strong>With Conditions:</strong> {Array.isArray(schema.fields) ? schema.fields.filter(f => f.conditionalLogic).length : 0}</p>
                    </div>
                  </div>

                  {/* Validation Results */}
                  {validationResults && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                          {validationResults.isValid ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              Validation Passed
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              Validation Failed
                            </>
                          )}
                        </h3>
                        {validationResults.errors.length > 0 && (
                          <div className="space-y-1">
                            {validationResults.errors.map((error, i) => (
                              <p key={i} className="text-xs text-destructive">
                                • {error.message}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="theme" className="p-4 m-0">
                <ThemePreviewSelector
                  theme={theme}
                  onThemeChange={handleThemeChange}
                />
              </TabsContent>

              <TabsContent value="data" className="p-4 m-0">
                <div className="overflow-auto max-h-[calc(100vh-200px)]">
                  <TestDataSimulator
                    schema={schema}
                    currentData={formData}
                    onApplyData={handleApplyTestData}
                  />
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Right Side - Preview */}
        <div className="flex-1 flex flex-col">
          {/* Test Panel */}
          {testMode && (
            <FormTestPanel
              schema={schema}
              formData={formData}
              onRunTest={handleRunTest}
            />
          )}

          {/* Device Preview */}
          <div className="flex-1">
            <DevicePreviewFrame
              initialDevice="iphone-14"
              showControls={true}
            >
              <div
                className="min-h-full p-4"
                style={{
                  '--theme-primary': theme.colors.primary,
                  '--theme-background': theme.colors.background,
                  '--theme-text': theme.colors.text,
                } as React.CSSProperties}
              >
                <FormRenderer
                  schema={schema}
                  initialData={formData}
                  onChange={handleFormChange}
                  onSubmit={handleSubmit}
                  showProgress={true}
                  className="border-0 shadow-none"
                />
              </div>
            </DevicePreviewFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createSampleSchema(id: string): FormSchema {
  return {
    id,
    version: 1,
    name: 'Sample Form',
    description: 'This is a sample form for preview',
    fields: [
      {
        id: 'field_1',
        type: 'text',
        label: 'Full Name',
        required: true,
        placeholder: 'Enter your full name',
      },
      {
        id: 'field_2',
        type: 'email',
        label: 'Email Address',
        required: true,
        placeholder: 'Enter your email',
      },
      {
        id: 'field_3',
        type: 'phone',
        label: 'Phone Number',
        required: false,
        placeholder: 'Enter your phone number',
      },
      {
        id: 'field_4',
        type: 'select',
        label: 'Department',
        required: true,
        options: [
          { value: 'hr', label: 'Human Resources' },
          { value: 'it', label: 'Information Technology' },
          { value: 'finance', label: 'Finance' },
          { value: 'operations', label: 'Operations' },
        ],
      },
      {
        id: 'field_5',
        type: 'textarea',
        label: 'Comments',
        required: false,
        placeholder: 'Any additional comments?',
      },
      {
        id: 'field_6',
        type: 'checkbox',
        label: 'I agree to the terms and conditions',
        required: true,
      },
      {
        id: 'field_7',
        type: 'rating',
        label: 'Satisfaction Rating',
        required: false,
        ratingMax: 5,
        ratingStyle: 'stars',
        ratingLabels: { low: 'Poor', high: 'Excellent' },
      },
    ],
    settings: {
      layout: 'single',
      showProgress: true,
      allowSave: true,
      autoSave: false,
      submission: {
        submitLabel: 'Submit Form',
        clearOnSubmit: false,
        requireConfirmation: true,
        confirmMessage: 'Are you sure you want to submit this form?',
      },
    },
  };
}
