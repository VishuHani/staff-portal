'use client';

import * as React from 'react';
import { 
  Sparkles, 
  Plus, 
  Lightbulb, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
  Wand2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FormField,
  FieldType,
  createNewField,
  FIELD_TYPE_CONFIGS,
} from '@/lib/types/form-schema';
import {
  AIFieldSuggestion,
  AIFieldSuggestionContext,
  FormTypeHint,
  FIELD_GROUPS,
  getFieldGroupSuggestions,
} from '@/lib/types/ai-form-types';

// ============================================================================
// SUGGESTION CARD COMPONENT
// ============================================================================

interface SuggestionCardProps {
  suggestion: AIFieldSuggestion;
  onAdd: (field: FormField) => void;
  onDismiss?: () => void;
}

function SuggestionCard({ suggestion, onAdd, onDismiss }: SuggestionCardProps) {
  const config = FIELD_TYPE_CONFIGS[suggestion.field.type];
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };
  
  const getCategoryIcon = (category: AIFieldSuggestion['category']) => {
    switch (category) {
      case 'required':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'recommended':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'contextual':
        return <Lightbulb className="h-3.5 w-3.5 text-blue-500" />;
      default:
        return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
    }
  };
  
  return (
    <div className="rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getCategoryIcon(suggestion.category)}
            <span className="text-sm font-medium truncate">
              {suggestion.field.label}
            </span>
            <Badge variant="outline" className="text-xs shrink-0">
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {suggestion.reason}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={cn('text-xs', getConfidenceColor(suggestion.confidence))}>
            {Math.round(suggestion.confidence * 100)}%
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAdd(suggestion.field)}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {suggestion.alternatives && suggestion.alternatives.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-1">Alternatives:</p>
          <div className="flex flex-wrap gap-1">
            {suggestion.alternatives.slice(0, 3).map((alt, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onAdd(alt)}
                className="h-6 text-xs px-2"
              >
                {alt.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FIELD GROUP CARD COMPONENT
// ============================================================================

interface FieldGroupCardProps {
  groupName: string;
  fields: FormField[];
  onAddGroup: (fields: FormField[]) => void;
  onAddField: (field: FormField) => void;
  existingFieldLabels: string[];
}

function FieldGroupCard({ 
  groupName, 
  fields, 
  onAddGroup, 
  onAddField,
  existingFieldLabels 
}: FieldGroupCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Filter out fields that already exist
  const newFields = fields.filter(
    f => !existingFieldLabels.some(
      label => label.toLowerCase() === f.label.toLowerCase()
    )
  );
  
  if (newFields.length === 0) return null;
  
  const formatGroupName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };
  
  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            isExpanded && "rotate-90"
          )} />
          <span className="text-sm font-medium">
            {formatGroupName(groupName)}
          </span>
          <Badge variant="secondary" className="text-xs">
            {newFields.length} fields
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAddGroup(newFields);
          }}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add All
        </Button>
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {newFields.map((field, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-2 rounded bg-background border"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{field.label}</span>
                <Badge variant="outline" className="text-xs">
                  {FIELD_TYPE_CONFIGS[field.type]?.label || field.type}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddField(field)}
                className="h-6 w-6 p-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI FIELD SUGGESTIONS PANEL
// ============================================================================

export interface AIFieldSuggestionsPanelProps {
  currentFields: FormField[];
  formName?: string;
  formDescription?: string;
  formType?: FormTypeHint;
  onAddField: (field: FormField) => void;
  onAddFields: (fields: FormField[]) => void;
  className?: string;
}

export function AIFieldSuggestionsPanel({
  currentFields,
  formName,
  formDescription,
  formType = 'custom',
  onAddField,
  onAddFields,
  className,
}: AIFieldSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = React.useState<AIFieldSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'suggestions' | 'groups'>('suggestions');
  
  const existingFieldLabels = currentFields.map(f => f.label);
  
  // Generate suggestions based on current fields and form type
  const generateSuggestions = React.useCallback(async () => {
    setIsLoading(true);
    
    try {
      // In a real implementation, this would call an AI service
      // For now, we'll generate rule-based suggestions
      const newSuggestions = generateRuleBasedSuggestions(
        currentFields,
        formType,
        formName,
        formDescription
      );
      
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentFields, formType, formName, formDescription]);
  
  React.useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);
  
  // Get relevant field groups
  const relevantGroups = getFieldGroupSuggestions(formType);
  
  const handleAddGroup = (fields: FormField[]) => {
    // Generate unique IDs for each field
    const fieldsWithIds = fields.map((field, index) => ({
      ...field,
      id: `field_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
    }));
    onAddFields(fieldsWithIds);
  };
  
  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">AI Suggestions</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateSuggestions}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Smart field suggestions based on your form
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              activeTab === 'suggestions'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Suggestions
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              activeTab === 'groups'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Field Groups
          </button>
        </div>
        
        {/* Content */}
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeTab === 'suggestions' ? (
              <>
                {suggestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">Your form looks complete!</p>
                  </div>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <SuggestionCard
                      key={`${suggestion.field.label}-${index}`}
                      suggestion={suggestion}
                      onAdd={onAddField}
                    />
                  ))
                )}
              </>
            ) : (
              <>
                {relevantGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Select a form type to see field groups</p>
                  </div>
                ) : (
                  relevantGroups.map((groupName) => {
                    const fields = FIELD_GROUPS[groupName];
                    if (!fields) return null;
                    return (
                      <FieldGroupCard
                        key={groupName}
                        groupName={groupName}
                        fields={fields}
                        onAddGroup={handleAddGroup}
                        onAddField={onAddField}
                        existingFieldLabels={existingFieldLabels}
                      />
                    );
                  })
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// RULE-BASED SUGGESTION GENERATOR
// ============================================================================

function generateRuleBasedSuggestions(
  currentFields: FormField[],
  formType: FormTypeHint,
  formName?: string,
  formDescription?: string
): AIFieldSuggestion[] {
  const suggestions: AIFieldSuggestion[] = [];
  const existingLabels = new Set(currentFields.map(f => f.label.toLowerCase()));
  const existingTypes = new Set(currentFields.map(f => f.type));
  
  // Common required fields based on form type
  const requiredFieldChecks: Array<{
    label: string;
    type: FieldType;
    reason: string;
    category: AIFieldSuggestion['category'];
    confidence: number;
  }> = [];
  
  // Check for common missing fields
  if (!existingLabels.has('email') && !existingTypes.has('email')) {
    requiredFieldChecks.push({
      label: 'Email Address',
      type: 'email',
      reason: 'Email is essential for form submissions and follow-ups',
      category: 'required',
      confidence: 0.95,
    });
  }
  
  if (!existingLabels.has('name') && !existingLabels.has('full name') && 
      !existingLabels.has('first name') && !existingLabels.has('last name')) {
    requiredFieldChecks.push({
      label: 'Full Name',
      type: 'text',
      reason: 'Name field is typically required for identification',
      category: 'required',
      confidence: 0.9,
    });
  }
  
  // Form type specific suggestions
  switch (formType) {
    case 'registration':
    case 'onboarding':
      if (!existingLabels.has('phone') && !existingLabels.has('phone number')) {
        requiredFieldChecks.push({
          label: 'Phone Number',
          type: 'phone',
          reason: 'Phone number is important for registration forms',
          category: 'recommended',
          confidence: 0.85,
        });
      }
      if (!existingLabels.has('date of birth') && !existingLabels.has('dob')) {
        requiredFieldChecks.push({
          label: 'Date of Birth',
          type: 'date',
          reason: 'Date of birth is commonly needed for registration',
          category: 'recommended',
          confidence: 0.75,
        });
      }
      break;
      
    case 'feedback':
    case 'survey':
      if (!existingTypes.has('rating')) {
        requiredFieldChecks.push({
          label: 'Overall Rating',
          type: 'rating',
          reason: 'Rating fields improve feedback form effectiveness',
          category: 'recommended',
          confidence: 0.85,
        });
      }
      if (!existingLabels.has('comments') && !existingLabels.has('feedback')) {
        requiredFieldChecks.push({
          label: 'Additional Comments',
          type: 'textarea',
          reason: 'Open feedback field allows detailed responses',
          category: 'recommended',
          confidence: 0.8,
        });
      }
      break;
      
    case 'application':
      if (!existingLabels.has('resume') && !existingLabels.has('cv')) {
        requiredFieldChecks.push({
          label: 'Resume/CV',
          type: 'file',
          reason: 'File upload is essential for job applications',
          category: 'required',
          confidence: 0.9,
        });
      }
      break;
      
    case 'contact':
      if (!existingLabels.has('message')) {
        requiredFieldChecks.push({
          label: 'Message',
          type: 'textarea',
          reason: 'Message field is essential for contact forms',
          category: 'required',
          confidence: 0.95,
        });
      }
      break;
  }
  
  // Check for consent fields
  const hasConsentField = Array.from(existingLabels).some(
    l => l.includes('consent') || l.includes('agree') || l.includes('terms')
  );
  if (!hasConsentField) {
    requiredFieldChecks.push({
      label: 'Privacy Consent',
      type: 'checkbox',
      reason: 'Consent fields ensure compliance with privacy regulations',
      category: 'recommended',
      confidence: 0.8,
    });
  }
  
  // Convert checks to suggestions
  for (const check of requiredFieldChecks) {
    if (!existingLabels.has(check.label.toLowerCase())) {
      const field = createNewField(check.type, currentFields.length);
      field.label = check.label;
      
      suggestions.push({
        field,
        confidence: check.confidence,
        reason: check.reason,
        category: check.category,
      });
    }
  }
  
  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);
  
  return suggestions.slice(0, 5); // Return top 5 suggestions
}

export default AIFieldSuggestionsPanel;