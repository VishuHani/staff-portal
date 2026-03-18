'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Send, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormSchema,
  FormField,
  FormData,
  FieldError,
  FieldValue,
} from '@/lib/types/form-schema';
import {
  validateField,
  validateForm,
  shouldShowField,
  shouldDisableField,
  isFormValid,
} from '@/lib/documents/form-validation';
import {
  TextField,
  TextareaField,
  NumberField,
  EmailField,
  PhoneField,
  DateField,
  TimeField,
  SelectField,
  MultiSelectField,
  RadioField,
  CheckboxField,
  ToggleField,
  FileField,
  ImageField,
  SignatureField,
  DividerField,
  HeaderField,
  ParagraphField,
  // Advanced fields
  RatingField,
  ScaleField,
  SliderField,
  CalculationField,
  CurrencyField,
  PercentageField,
  UrlField,
  MatrixField,
  // Repeating section
  RepeatingSectionRenderer,
} from '@/components/documents/form-builder';

// ============================================================================
// FORM RENDERER PROPS
// ============================================================================

export interface FormRendererProps {
  schema: FormSchema;
  initialData?: FormData;
  onSubmit: (data: FormData) => void | Promise<void>;
  onSaveDraft?: (data: FormData) => void | Promise<void>;
  onChange?: (data: FormData) => void;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  submitLabel?: string;
  showProgress?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
}

// ============================================================================
// FORM RENDERER STATE
// ============================================================================

interface FormRendererState {
  data: FormData;
  errors: FieldError[];
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isSubmitting: boolean;
  isSaving: boolean;
  currentStep: number;
  submitSuccess: boolean;
  submitError: string | null;
}

// ============================================================================
// FORM RENDERER COMPONENT
// ============================================================================

export function FormRenderer({
  schema,
  initialData = {},
  onSubmit,
  onSaveDraft,
  onChange,
  readOnly = false,
  disabled = false,
  className,
  submitLabel = 'Submit',
  showProgress = true,
  validateOnBlur = true,
  validateOnChange = false,
}: FormRendererProps) {
  // Initialize state
  const [state, setState] = React.useState<FormRendererState>({
    data: initialData,
    errors: [],
    touched: {},
    dirty: {},
    isSubmitting: false,
    isSaving: false,
    currentStep: 0,
    submitSuccess: false,
    submitError: null,
  });

  // Sync state when initialData changes from outside (e.g., TestDataSimulator)
  React.useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setState((prev) => ({
        ...prev,
        data: initialData,
        submitSuccess: false,
        submitError: null,
      }));
    }
  }, [initialData]);

  // Ref for auto-save
  const autoSaveRef = React.useRef<NodeJS.Timeout | null>(null);

  // Get visible fields based on conditional logic
  const visibleFields = React.useMemo(() => {
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    return fields.filter((field) => shouldShowField(field, state.data));
  }, [schema.fields, state.data]);

  // Calculate progress
  const progress = React.useMemo(() => {
    const requiredFields = visibleFields.filter((f) => f.required);
    if (requiredFields.length === 0) return 100;

    const filledRequired = requiredFields.filter((f) => {
      const value = state.data[f.id];
      return value !== undefined && value !== null && value !== '';
    });

    return Math.round((filledRequired.length / requiredFields.length) * 100);
  }, [visibleFields, state.data]);

  // Handle field change
  const handleFieldChange = (fieldId: string, value: unknown) => {
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    setState((prev) => {
      const newData = { ...prev.data, [fieldId]: value as FieldValue };
      const newDirty = { ...prev.dirty, [fieldId]: true };

      // Validate on change if enabled
      let newErrors = prev.errors;
      if (validateOnChange) {
        const field = fields.find((f) => f.id === fieldId);
        if (field) {
          const error = validateField(field, value, newData);
          newErrors = prev.errors.filter((e) => e.fieldId !== fieldId);
          if (error) {
            newErrors.push(error);
          }
        }
      }

      return {
        ...prev,
        data: newData,
        dirty: newDirty,
        errors: newErrors,
      };
    });

    // Notify parent of change
    onChange?.({ ...state.data, [fieldId]: value as FieldValue });
  };

  // Handle field blur
  const handleFieldBlur = (fieldId: string) => {
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [fieldId]: true },
    }));

    // Validate on blur if enabled
    if (validateOnBlur) {
      const field = fields.find((f) => f.id === fieldId);
      if (field) {
        const error = validateField(field, state.data[fieldId], state.data);
        setState((prev) => {
          const newErrors = prev.errors.filter((e) => e.fieldId !== fieldId);
          if (error) {
            newErrors.push(error);
          }
          return { ...prev, errors: newErrors };
        });
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (readOnly || disabled) return;

    const fields = Array.isArray(schema.fields) ? schema.fields : [];

    // Validate all fields
    const errors = validateForm(schema, state.data);
    setState((prev) => ({ ...prev, errors }));

    if (errors.length > 0) {
      // Mark all fields as touched to show errors
      const allTouched: Record<string, boolean> = {};
      fields.forEach((f) => {
        allTouched[f.id] = true;
      });
      setState((prev) => ({ ...prev, touched: allTouched }));
      return;
    }

    // Submit
    setState((prev) => ({ ...prev, isSubmitting: true, submitError: null }));

    try {
      await onSubmit(state.data);
      setState((prev) => ({ ...prev, isSubmitting: false, submitSuccess: true }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        submitError: error instanceof Error ? error.message : 'An error occurred',
      }));
    }
  };

  // Handle save draft
  const handleSaveDraft = async () => {
    if (!onSaveDraft || readOnly || disabled) return;

    setState((prev) => ({ ...prev, isSaving: true }));

    try {
      await onSaveDraft(state.data);
      setState((prev) => ({ ...prev, isSaving: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        submitError: error instanceof Error ? error.message : 'Failed to save draft',
      }));
    }
  };

  // Auto-save effect
  React.useEffect(() => {
    if (!schema.settings.autoSave || !onSaveDraft) return;

    // Clear existing timer
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    // Set new timer
    autoSaveRef.current = setTimeout(() => {
      if (Object.keys(state.dirty).length > 0) {
        onSaveDraft(state.data);
        setState((prev) => ({ ...prev, dirty: {} }));
      }
    }, schema.settings.autoSaveInterval || 30000);

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [state.data, state.dirty, schema.settings.autoSave, schema.settings.autoSaveInterval, onSaveDraft]);

  // Render field
  const renderField = (field: FormField) => {
    const value = state.data[field.id];
    const error = state.errors.find((e) => e.fieldId === field.id);
    const isDisabled = disabled || shouldDisableField(field, state.data);

    const commonProps = {
      field,
      value,
      onChange: (val: unknown) => handleFieldChange(field.id, val),
      onBlur: () => handleFieldBlur(field.id),
      error,
      disabled: isDisabled,
      readOnly,
    };

    // Layout fields don't have value/change handlers
    if (field.type === 'divider') {
      return <DividerField key={field.id} />;
    }

    if (field.type === 'header') {
      return <HeaderField key={field.id} field={field} />;
    }

    if (field.type === 'paragraph') {
      return <ParagraphField key={field.id} field={field} />;
    }

    // Input fields
    switch (field.type) {
      case 'text':
        return <TextField key={field.id} {...commonProps} />;
      case 'textarea':
        return <TextareaField key={field.id} {...commonProps} />;
      case 'number':
        return <NumberField key={field.id} {...commonProps} />;
      case 'email':
        return <EmailField key={field.id} {...commonProps} />;
      case 'phone':
        return <PhoneField key={field.id} {...commonProps} />;
      case 'date':
        return <DateField key={field.id} {...commonProps} />;
      case 'time':
        return <TimeField key={field.id} {...commonProps} />;
      case 'select':
        return <SelectField key={field.id} {...commonProps} />;
      case 'multiselect':
        return <MultiSelectField key={field.id} {...commonProps} />;
      case 'radio':
        return <RadioField key={field.id} {...commonProps} />;
      case 'checkbox':
        return <CheckboxField key={field.id} {...commonProps} />;
      case 'toggle':
        return <ToggleField key={field.id} {...commonProps} />;
      case 'file':
        return <FileField key={field.id} {...commonProps} />;
      case 'image':
        return <ImageField key={field.id} {...commonProps} />;
      case 'signature':
        return <SignatureField key={field.id} {...commonProps} />;
      // Advanced fields - these have simpler props
      case 'rating':
        return <RatingField key={field.id} field={field} value={value as number | undefined} onChange={(val: number) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      case 'scale':
        return <ScaleField key={field.id} field={field} value={value as number | null | undefined} onChange={(val: number) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      case 'slider':
        return <SliderField key={field.id} field={field} value={value as number | undefined} onChange={(val: number) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      case 'calculation':
        return <CalculationField key={field.id} field={field} value={value as number | undefined} />;
      case 'currency':
        return <CurrencyField key={field.id} field={field} value={value as number | null | undefined} onChange={(val: number | null) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      case 'percentage':
        return <PercentageField key={field.id} field={field} value={value as number | null | undefined} onChange={(val: number | null) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      case 'url':
        return <UrlField key={field.id} field={field} value={value as string | undefined} onChange={(val: string) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      case 'matrix':
        return <MatrixField key={field.id} field={field} value={value as Record<string, string | string[]> | undefined} onChange={(val: Record<string, string | string[]>) => handleFieldChange(field.id, val)} error={error?.message} disabled={isDisabled} />;
      // Structural fields
      case 'repeating_section':
        return (
          <RepeatingSectionRenderer
            key={field.id}
            field={field}
            value={(value as Record<string, unknown>[] | undefined) || []}
            onChange={(val: Record<string, unknown>[]) => handleFieldChange(field.id, val)}
            error={error?.message}
          />
        );
      case 'page_break':
        // Page breaks are handled by MultiPageForm, not rendered individually
        return null;
      default:
        return null;
    }
  };

  // Success state
  if (state.submitSuccess) {
    return (
      <Card className={cn('max-w-2xl mx-auto', className)}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Form Submitted Successfully</h2>
            <p className="text-muted-foreground">
              {schema.settings.submission?.confirmMessage || 'Thank you for your submission.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('max-w-2xl mx-auto', className)}>
      <CardHeader>
        <CardTitle>{schema.name}</CardTitle>
        {schema.description && (
          <CardDescription>{schema.description}</CardDescription>
        )}
        {showProgress && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Submit Error */}
          {state.submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.submitError}</AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          <div className="space-y-6">
            {visibleFields.map((field) => renderField(field))}
          </div>

          {/* Form Actions */}
          {!readOnly && (
            <div className="flex justify-between pt-4 border-t">
              <div>
                {onSaveDraft && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={state.isSaving || disabled}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {state.isSaving ? 'Saving...' : 'Save Draft'}
                  </Button>
                )}
              </div>
              <Button
                type="submit"
                disabled={state.isSubmitting || disabled}
              >
                <Send className="h-4 w-4 mr-2" />
                {state.isSubmitting ? 'Submitting...' : submitLabel}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MULTI-STEP FORM RENDERER
// ============================================================================

export interface MultiStepFormRendererProps extends FormRendererProps {
  // Additional props for multi-step forms
}

export function MultiStepFormRenderer({
  schema,
  initialData = {},
  onSubmit,
  onSaveDraft,
  onChange,
  readOnly = false,
  disabled = false,
  className,
  submitLabel = 'Submit',
}: MultiStepFormRendererProps) {
  // Group fields by sections (using header fields as section markers)
  const sections = React.useMemo(() => {
    const result: { title: string; fields: FormField[] }[] = [];
    let currentSection: { title: string; fields: FormField[] } = {
      title: 'Section 1',
      fields: [],
    };

    const fields = Array.isArray(schema.fields) ? schema.fields : [];

    fields.forEach((field) => {
      if (field.type === 'header') {
        if (currentSection.fields.length > 0) {
          result.push(currentSection);
        }
        currentSection = {
          title: field.label || `Section ${result.length + 1}`,
          fields: [],
        };
      } else {
        currentSection.fields.push(field);
      }
    });

    if (currentSection.fields.length > 0) {
      result.push(currentSection);
    }

    return result.length > 0 ? result : [{ title: 'Form', fields }];
  }, [schema.fields]);

  const [currentStep, setCurrentStep] = React.useState(0);
  const [data, setData] = React.useState<FormData>(initialData);
  const [errors, setErrors] = React.useState<FieldError[]>([]);

  const currentSection = sections[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === sections.length - 1;

  const handleFieldChange = (fieldId: string, value: unknown) => {
    const newData = { ...data, [fieldId]: value as FieldValue };
    setData(newData);
    onChange?.(newData);
  };

  const handleNext = () => {
    // Validate current step
    const stepErrors = validateForm(
      { ...schema, fields: currentSection.fields },
      data
    );
    
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors([]);
    setCurrentStep((prev) => Math.min(prev + 1, sections.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const allErrors = validateForm(schema, data);
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }

    await onSubmit(data);
  };

  // Render field (same as single form)
  const renderField = (field: FormField) => {
    const value = data[field.id];
    const error = errors.find((e) => e.fieldId === field.id);

    const commonProps = {
      field,
      value,
      onChange: (val: unknown) => handleFieldChange(field.id, val),
      onBlur: () => {},
      error,
      disabled,
      readOnly,
    };

    if (field.type === 'divider') return <DividerField key={field.id} />;
    if (field.type === 'header') return <HeaderField key={field.id} field={field} />;
    if (field.type === 'paragraph') return <ParagraphField key={field.id} field={field} />;

    switch (field.type) {
      case 'text': return <TextField key={field.id} {...commonProps} />;
      case 'textarea': return <TextareaField key={field.id} {...commonProps} />;
      case 'number': return <NumberField key={field.id} {...commonProps} />;
      case 'email': return <EmailField key={field.id} {...commonProps} />;
      case 'phone': return <PhoneField key={field.id} {...commonProps} />;
      case 'date': return <DateField key={field.id} {...commonProps} />;
      case 'time': return <TimeField key={field.id} {...commonProps} />;
      case 'select': return <SelectField key={field.id} {...commonProps} />;
      case 'multiselect': return <MultiSelectField key={field.id} {...commonProps} />;
      case 'radio': return <RadioField key={field.id} {...commonProps} />;
      case 'checkbox': return <CheckboxField key={field.id} {...commonProps} />;
      case 'toggle': return <ToggleField key={field.id} {...commonProps} />;
      case 'file': return <FileField key={field.id} {...commonProps} />;
      case 'image': return <ImageField key={field.id} {...commonProps} />;
      case 'signature': return <SignatureField key={field.id} {...commonProps} />;
      default: return null;
    }
  };

  return (
    <Card className={cn('max-w-2xl mx-auto', className)}>
      <CardHeader>
        <CardTitle>{schema.name}</CardTitle>
        {schema.description && (
          <CardDescription>{schema.description}</CardDescription>
        )}
        {/* Step indicators */}
        <div className="flex gap-2 mt-4">
          {sections.map((section, index) => (
            <div
              key={index}
              className={cn(
                'flex-1 h-2 rounded-full transition-colors',
                index <= currentStep ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Title */}
          <h3 className="text-lg font-semibold">{currentSection.title}</h3>

          {/* Current Step Fields */}
          <div className="space-y-6">
            {currentSection.fields
              .filter((field) => shouldShowField(field, data))
              .map(renderField)}
          </div>

          {/* Navigation */}
          {!readOnly && (
            <div className="flex justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={isFirstStep || disabled}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <div className="flex gap-2">
                {onSaveDraft && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSaveDraft(data)}
                    disabled={disabled}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                )}
                {isLastStep ? (
                  <Button type="submit" disabled={disabled}>
                    <Send className="h-4 w-4 mr-2" />
                    {submitLabel}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={disabled}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default FormRenderer;
