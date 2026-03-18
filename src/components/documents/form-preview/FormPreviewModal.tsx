'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  TestTube,
  Settings,
  Palette,
  Database,
  X,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormSchema, FormData, FormField } from '@/lib/types/form-schema';
import { FormRenderer } from '@/components/documents/form-renderer/FormRenderer';
import { DevicePreviewFrame, DevicePreset } from './DevicePreviewFrame';
import { FormTestPanel } from './FormTestPanel';
import { ThemePreviewSelector } from './ThemePreviewSelector';
import { TestDataSimulator } from './TestDataSimulator';
import type { FormTheme } from '@/lib/types/form-theme';

// ============================================================================
// FORM PREVIEW MODAL PROPS
// ============================================================================

interface FormPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: FormSchema;
  theme?: FormTheme;
  onThemeChange?: (theme: FormTheme) => void;
  previewMode?: 'preview' | 'test';
  showTestData?: boolean;
  onTestDataApply?: (data: FormData) => void;
}

// ============================================================================
// FORM PREVIEW MODAL COMPONENT
// ============================================================================

export function FormPreviewModal({
  open,
  onOpenChange,
  schema,
  theme,
  onThemeChange,
  previewMode = 'preview',
  showTestData = true,
  onTestDataApply,
}: FormPreviewModalProps) {
  const [mode, setMode] = React.useState<'preview' | 'test'>(previewMode);
  const [formData, setFormData] = React.useState<FormData>({});
  const [selectedDevice, setSelectedDevice] = React.useState<DevicePreset | null>(null);
  const [currentTheme, setCurrentTheme] = React.useState<FormTheme | undefined>(theme);
  const [testResults, setTestResults] = React.useState<{
    validationPassed: boolean;
    conditionalRulesMet: number;
    conditionalRulesTotal: number;
    errors: string[];
  } | null>(null);

  // Handle form data changes
  const handleFormChange = (data: FormData) => {
    setFormData(data);
  };

  // Handle test data application
  const handleApplyTestData = (data: FormData) => {
    setFormData(data);
    onTestDataApply?.(data);
  };

  // Handle theme changes
  const handleThemeChange = (newTheme: FormTheme) => {
    setCurrentTheme(newTheme);
    onThemeChange?.(newTheme);
  };

  // Handle device changes
  const handleDeviceChange = (device: DevicePreset) => {
    setSelectedDevice(device);
  };

  // Reset form
  const handleReset = () => {
    setFormData({});
    setTestResults(null);
  };

  // Run validation test
  const runValidationTest = () => {
    const errors: string[] = [];
    let conditionalRulesMet = 0;
    let conditionalRulesTotal = 0;

    const fields = Array.isArray(schema.fields) ? schema.fields : [];

    // Check required fields
    fields.forEach((field) => {
      if (field.required) {
        const value = formData[field.id];
        if (value === undefined || value === null || value === '') {
          errors.push(`Field "${field.label}" is required but empty`);
        }
      }

      // Count conditional rules
      if (field.conditionalLogic) {
        conditionalRulesTotal++;
        // Simple check - in real implementation, this would use the actual condition evaluator
        conditionalRulesMet++;
      }
    });

    setTestResults({
      validationPassed: errors.length === 0,
      conditionalRulesMet,
      conditionalRulesTotal,
      errors,
    });
  };

  // Mock submit handler for preview
  const handleSubmit = async (data: FormData) => {
    console.log('Form submitted (preview mode):', data);
    alert('Form submitted successfully! (Preview Mode - No data saved)');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg">Form Preview</DialogTitle>
              <Badge variant="outline" className="text-xs">
                {schema.name}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Array.isArray(schema.fields) ? schema.fields.length : 0} fields
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/manage/documents/preview/${schema.id}`, '_blank')}
                className="gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in New Tab
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 flex h-[calc(95vh-80px)]">
          {/* Left Panel - Controls */}
          <div className="w-80 border-r bg-muted/30 flex flex-col">
            <Tabs defaultValue="settings" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 m-2">
                <TabsTrigger value="settings" className="text-xs">
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="theme" className="text-xs">
                  <Palette className="h-3.5 w-3.5 mr-1" />
                  Theme
                </TabsTrigger>
                <TabsTrigger value="data" className="text-xs">
                  <Database className="h-3.5 w-3.5 mr-1" />
                  Data
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                {/* Settings Tab */}
                <TabsContent value="settings" className="p-4 m-0">
                  <div className="space-y-4">
                    {/* Preview Mode Toggle */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Preview Mode</label>
                      <div className="flex gap-2">
                        <Button
                          variant={mode === 'preview' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMode('preview')}
                          className="flex-1"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant={mode === 'test' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMode('test')}
                          className="flex-1"
                        >
                          <TestTube className="h-3.5 w-3.5 mr-1" />
                          Test
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Form Info */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Form Information</label>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p><strong>Name:</strong> {schema.name}</p>
                        <p><strong>Version:</strong> {schema.version}</p>
                        <p><strong>Fields:</strong> {Array.isArray(schema.fields) ? schema.fields.length : 0}</p>
                        <p><strong>Required:</strong> {Array.isArray(schema.fields) ? schema.fields.filter(f => f.required).length : 0}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Device Info */}
                    {selectedDevice && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Current Device</label>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p><strong>Device:</strong> {selectedDevice.name}</p>
                          <p><strong>Size:</strong> {selectedDevice.width}×{selectedDevice.height}</p>
                          <p><strong>Type:</strong> {selectedDevice.category}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Theme Tab */}
                <TabsContent value="theme" className="p-4 m-0">
                  <ThemePreviewSelector
                    theme={currentTheme}
                    onThemeChange={handleThemeChange}
                  />
                </TabsContent>

                {/* Data Tab */}
                <TabsContent value="data" className="p-4 m-0">
                  <TestDataSimulator
                    schema={schema}
                    currentData={formData}
                    onApplyData={handleApplyTestData}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Test Results Panel */}
            {mode === 'test' && testResults && (
              <div className="border-t p-4 bg-background">
                <div className="flex items-center gap-2 mb-2">
                  {testResults.validationPassed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {testResults.validationPassed ? 'Validation Passed' : 'Validation Failed'}
                  </span>
                </div>
                {testResults.errors.length > 0 && (
                  <div className="text-xs space-y-1 text-muted-foreground">
                    {testResults.errors.map((error, i) => (
                      <p key={i} className="text-red-500">• {error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col">
            {/* Test Panel (when in test mode) */}
            {mode === 'test' && (
              <div className="border-b">
                <FormTestPanel
                  schema={schema}
                  formData={formData}
                  onRunTest={runValidationTest}
                />
              </div>
            )}

            {/* Device Preview */}
            <div className="flex-1">
              <DevicePreviewFrame
                initialDevice="iphone-14"
                onDeviceChange={handleDeviceChange}
                showControls={true}
              >
                <div
                  className="min-h-full"
                  style={currentTheme ? {
                    '--theme-primary': currentTheme.colors.primary,
                    '--theme-background': currentTheme.colors.background,
                    '--theme-text': currentTheme.colors.text,
                  } as React.CSSProperties : undefined}
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
      </DialogContent>
    </Dialog>
  );
}

export default FormPreviewModal;
