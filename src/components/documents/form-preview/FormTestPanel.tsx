'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormSchema, FormData, FormField, ConditionalLogic } from '@/lib/types/form-schema';

// ============================================================================
// FORM TEST PANEL PROPS
// ============================================================================

interface FormTestPanelProps {
  schema: FormSchema;
  formData: FormData;
  onRunTest?: () => void;
  showConditionalLogic?: boolean;
}

// ============================================================================
// FORM TEST PANEL COMPONENT
// ============================================================================

export function FormTestPanel({
  schema,
  formData,
  onRunTest,
  showConditionalLogic = true,
}: FormTestPanelProps) {
  const [expandedField, setExpandedField] = React.useState<string | null>(null);

  // Analyze form for test info
  const analysis = React.useMemo(() => {
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const requiredFields = fields.filter((f) => f.required);
    const filledRequired = requiredFields.filter((f) => {
      const value = formData[f.id];
      return value !== undefined && value !== null && value !== '';
    });

    const fieldsWithConditions = fields.filter((f) => f.conditionalLogic);
    const visibleFields = fields.filter((f) => {
      // Simple visibility check - in real implementation, use shouldShowField
      if (!f.conditionalLogic) return true;
      // For now, assume all are visible
      return true;
    });

    const hiddenFields = fields.filter((f) => !visibleFields.includes(f));

    return {
      totalFields: fields.length,
      requiredFields: requiredFields.length,
      filledRequired: filledRequired.length,
      fieldsWithConditions: fieldsWithConditions.length,
      visibleFields: visibleFields.length,
      hiddenFields: hiddenFields.length,
      completionPercentage: requiredFields.length > 0
        ? Math.round((filledRequired.length / requiredFields.length) * 100)
        : 100,
    };
  }, [schema, formData]);

  // Get field status
  const getFieldStatus = (field: FormField): 'filled' | 'empty' | 'hidden' | 'disabled' => {
    const value = formData[field.id];
    if (field.conditionalLogic) {
      // Check if hidden by condition
      // For now, assume visible
    }
    if (value !== undefined && value !== null && value !== '') {
      return 'filled';
    }
    return 'empty';
  };

  return (
    <div className="bg-muted/30 border-b">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          {/* Progress Summary */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Progress:</span>
            <Badge variant={analysis.completionPercentage === 100 ? 'default' : 'secondary'}>
              {analysis.completionPercentage}%
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Required Fields */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Required:</span>
            <span className="text-sm font-medium">
              {analysis.filledRequired}/{analysis.requiredFields}
            </span>
          </div>

          {/* Conditional Logic */}
          {showConditionalLogic && analysis.fieldsWithConditions > 0 && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Conditional Fields:</span>
                <span className="text-sm font-medium">{analysis.fieldsWithConditions}</span>
              </div>
            </>
          )}

          {/* Hidden Fields */}
          {analysis.hiddenFields > 0 && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {analysis.hiddenFields} hidden
                </span>
              </div>
            </>
          )}
        </div>

        {/* Run Test Button */}
        {onRunTest && (
          <Button size="sm" onClick={onRunTest} className="gap-1">
            <Play className="h-3.5 w-3.5" />
            Run Validation Test
          </Button>
        )}
      </div>

      {/* Field Status List */}
      <ScrollArea className="h-32 border-t">
        <div className="p-2 grid grid-cols-4 gap-1">
          {(Array.isArray(schema.fields) ? schema.fields : []).map((field) => {
            const status = getFieldStatus(field);
            const isExpanded = expandedField === field.id;

            return (
              <button
                key={field.id}
                onClick={() => setExpandedField(isExpanded ? null : field.id)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded text-xs text-left transition-colors',
                  'hover:bg-muted',
                  status === 'filled' && 'bg-green-50 dark:bg-green-950/30',
                  status === 'empty' && field.required && 'bg-red-50 dark:bg-red-950/30',
                  status === 'hidden' && 'opacity-50',
                  isExpanded && 'ring-2 ring-primary'
                )}
              >
                {status === 'filled' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                )}
                {status === 'empty' && field.required && (
                  <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                )}
                {status === 'empty' && !field.required && (
                  <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                )}
                {status === 'hidden' && (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate">{field.label}</span>
                {field.conditionalLogic && (
                  <ToggleRight className="h-3 w-3 text-blue-500 flex-shrink-0 ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default FormTestPanel;
