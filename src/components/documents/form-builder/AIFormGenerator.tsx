'use client';

import * as React from 'react';
import { 
  Wand2, 
  Sparkles, 
  Loader2, 
  FileText, 
  Upload,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormSchema,
  FormField,
  createNewSchema,
} from '@/lib/types/form-schema';
import {
  FormTypeHint,
  AIFormGenerationOptions,
  AIFormGenerationResult,
} from '@/lib/types/ai-form-types';
import { generateFormFromDescription } from '@/lib/actions/documents/ai-form-generation';

// ============================================================================
// FORM TYPE SELECTOR
// ============================================================================

const FORM_TYPES: { value: FormTypeHint; label: string; description: string }[] = [
  { value: 'registration', label: 'Registration', description: 'User sign-up forms' },
  { value: 'feedback', label: 'Feedback', description: 'Collect user feedback' },
  { value: 'survey', label: 'Survey', description: 'Surveys and questionnaires' },
  { value: 'application', label: 'Application', description: 'Job or service applications' },
  { value: 'contact', label: 'Contact', description: 'Contact forms' },
  { value: 'onboarding', label: 'Onboarding', description: 'Employee/user onboarding' },
  { value: 'incident_report', label: 'Incident Report', description: 'Report incidents or issues' },
  { value: 'leave_request', label: 'Leave Request', description: 'Time-off requests' },
  { value: 'expense_claim', label: 'Expense Claim', description: 'Expense submissions' },
  { value: 'assessment', label: 'Assessment', description: 'Skills or knowledge assessments' },
  { value: 'compliance', label: 'Compliance', description: 'Compliance and policy forms' },
  { value: 'custom', label: 'Custom', description: 'Custom form type' },
];

// ============================================================================
// AI FORM GENERATOR COMPONENT
// ============================================================================

export interface AIFormGeneratorProps {
  onFormGenerated: (schema: FormSchema) => void;
  className?: string;
}

export function AIFormGenerator({ onFormGenerated, className }: AIFormGeneratorProps) {
  const [description, setDescription] = React.useState('');
  const [formName, setFormName] = React.useState('');
  const [formType, setFormType] = React.useState<FormTypeHint>('custom');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewSchema, setPreviewSchema] = React.useState<FormSchema | null>(null);
  const [generationMeta, setGenerationMeta] = React.useState<{
    fieldCount: number;
    confidence: number;
    aiGenerated: boolean;
  } | null>(null);
  
  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please enter a description for your form');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setPreviewSchema(null);
    setGenerationMeta(null);
    
    try {
      const result = await generateFormFromDescription(description, {
        name: formName || undefined,
      });
      
      if (result.success && result.data) {
        setPreviewSchema(result.data);
        setGenerationMeta({
          fieldCount: result.data.fields.length,
          confidence: 0.85, // Default confidence
          aiGenerated: true,
        });
      } else {
        setError(result.error || 'Failed to generate form');
      }
    } catch (err) {
      console.error('Error generating form:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleUseForm = () => {
    if (previewSchema) {
      onFormGenerated(previewSchema);
      // Reset state
      setDescription('');
      setFormName('');
      setPreviewSchema(null);
      setGenerationMeta(null);
    }
  };
  
  const handleRegenerate = () => {
    handleGenerate();
  };
  
  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">AI Form Generator</CardTitle>
          <Badge variant="secondary" className="text-xs">
            Beta
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Describe your form and let AI create it for you
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto space-y-4">
        {/* Form Name */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Form Name (optional)</Label>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Employee Registration Form"
            className="h-8 text-sm"
          />
        </div>
        
        {/* Form Type */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Form Type</Label>
          <Select value={formType} onValueChange={(v) => setFormType(v as FormTypeHint)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col">
                    <span>{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Describe Your Form</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what fields and information your form should collect. For example: 'A job application form with personal details, work experience, education, and file upload for resume'"
            className="min-h-[120px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Be specific about the fields you need. Include any validation requirements.
          </p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Form
            </>
          )}
        </Button>
        
        {/* Preview */}
        {previewSchema && (
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Generated Form Preview</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="h-7"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isGenerating && "animate-spin")} />
                Regenerate
              </Button>
            </div>
            
            {/* Meta info */}
            {generationMeta && (
              <div className="flex gap-3">
                <Badge variant="outline" className="text-xs">
                  {generationMeta.fieldCount} fields
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {Math.round(generationMeta.confidence * 100)}% confidence
                </Badge>
                {generationMeta.aiGenerated && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Generated
                  </Badge>
                )}
              </div>
            )}
            
            {/* Form name and description */}
            <div className="p-3 rounded-lg bg-muted/30 border">
              <h5 className="text-sm font-medium">{previewSchema.name}</h5>
              {previewSchema.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {previewSchema.description}
                </p>
              )}
            </div>
            
            {/* Field list */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase">
                Fields ({previewSchema.fields.length})
              </h5>
              <div className="max-h-[200px] overflow-auto space-y-1">
                {previewSchema.fields.map((field, index) => (
                  <div
                    key={field.id || index}
                    className="flex items-center justify-between p-2 rounded bg-background border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.label}</span>
                      {field.required && (
                        <Badge variant="outline" className="text-xs h-5">
                          Required
                        </Badge>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {field.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Use Form Button */}
            <Button onClick={handleUseForm} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Use This Form
            </Button>
          </div>
        )}
        
        {/* Quick Templates */}
        {!previewSchema && (
          <div className="pt-3 border-t">
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Quick Templates
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Contact Form', desc: 'Name, email, phone, message' },
                { name: 'Feedback Form', desc: 'Rating, comments, suggestions' },
                { name: 'Registration', desc: 'Personal info, account details' },
                { name: 'Survey', desc: 'Multiple choice, ratings, text' },
              ].map((template) => (
                <button
                  key={template.name}
                  onClick={() => {
                    setFormName(template.name);
                    setDescription(`Create a ${template.name.toLowerCase()} with: ${template.desc}`);
                  }}
                  className="p-2 rounded-lg border text-left hover:border-primary/50 transition-colors"
                >
                  <p className="text-xs font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIFormGenerator;