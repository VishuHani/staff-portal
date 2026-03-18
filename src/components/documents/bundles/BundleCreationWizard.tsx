"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus, 
  Trash2, 
  GripVertical, 
  FileText, 
  Clock, 
  Bell,
  AlertCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentTemplate } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface BundleItem {
  templateId: string;
  template?: DocumentTemplate;
  order: number;
  isRequired: boolean;
}

export interface BundleFormData {
  name: string;
  description: string;
  category: string;
  isRequired: boolean;
  allowPartialComplete: boolean;
  dueWithinDays: number | null;
  reminderDays: number[];
  items: BundleItem[];
}

interface BundleCreationWizardProps {
  venueId: string;
  templates: DocumentTemplate[];
  onComplete: (data: BundleFormData) => Promise<void>;
  onCancel: () => void;
}

type WizardStep = {
  id: string;
  title: string;
  description: string;
};

const WIZARD_STEPS: WizardStep[] = [
  { id: "basic", title: "Basic Info", description: "Name and description" },
  { id: "documents", title: "Select Documents", description: "Choose templates" },
  { id: "order", title: "Configure Order", description: "Set requirements" },
  { id: "timing", title: "Due Dates & Reminders", description: "Set schedule" },
  { id: "review", title: "Review", description: "Confirm and create" },
];

const CATEGORIES = [
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "CERTIFICATION", label: "Certification" },
  { value: "HR", label: "HR Documents" },
  { value: "POLICY", label: "Policy" },
  { value: "GENERAL", label: "General" },
];

const REMINDER_OPTIONS = [
  { value: 7, label: "1 week before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
  { value: 0, label: "On due date" },
];

const DEFAULT_FORM_DATA: BundleFormData = {
  name: "",
  description: "",
  category: "GENERAL",
  isRequired: true,
  allowPartialComplete: false,
  dueWithinDays: 14,
  reminderDays: [3, 1],
  items: [],
};

// ============================================================================
// Component
// ============================================================================

export function BundleCreationWizard({
  venueId,
  templates,
  onComplete,
  onCancel,
}: BundleCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BundleFormData>(DEFAULT_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step validation
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Basic Info
        if (!formData.name.trim()) {
          newErrors.name = "Bundle name is required";
        }
        if (formData.name.length > 255) {
          newErrors.name = "Name must be less than 255 characters";
        }
        break;
      case 1: // Select Documents
        if (formData.items.length === 0) {
          newErrors.items = "At least one document must be selected";
        }
        break;
      case 2: // Configure Order
        // No validation needed - order is automatic
        break;
      case 3: // Due Dates & Reminders
        if (formData.dueWithinDays !== null && formData.dueWithinDays < 1) {
          newErrors.dueWithinDays = "Due days must be at least 1";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleComplete = useCallback(async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      await onComplete(formData);
    } catch (error) {
      console.error("Error creating bundle:", error);
      setErrors({ submit: "Failed to create bundle. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, formData, onComplete, validateStep]);

  const toggleTemplate = useCallback((templateId: string) => {
    setFormData((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.templateId === templateId);
      
      if (existingIndex >= 0) {
        // Remove template
        const newItems = prev.items
          .filter((item) => item.templateId !== templateId)
          .map((item, index) => ({ ...item, order: index }));
        return { ...prev, items: newItems };
      } else {
        // Add template
        const template = templates.find((t) => t.id === templateId);
        const newItem: BundleItem = {
          templateId,
          template,
          order: prev.items.length,
          isRequired: true,
        };
        return { ...prev, items: [...prev.items, newItem] };
      }
    });
  }, [templates]);

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      return {
        ...prev,
        items: newItems.map((item, index) => ({ ...item, order: index })),
      };
    });
  }, []);

  const toggleItemRequired = useCallback((templateId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.templateId === templateId ? { ...item, isRequired: !item.isRequired } : item
      ),
    }));
  }, []);

  const removeItem = useCallback((templateId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items
        .filter((item) => item.templateId !== templateId)
        .map((item, index) => ({ ...item, order: index })),
    }));
  }, []);

  const toggleReminder = useCallback((days: number) => {
    setFormData((prev) => {
      const hasReminder = prev.reminderDays.includes(days);
      const newReminders = hasReminder
        ? prev.reminderDays.filter((d) => d !== days)
        : [...prev.reminderDays, days].sort((a, b) => b - a);
      return { ...prev, reminderDays: newReminders };
    });
  }, []);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderDocumentsStep();
      case 2:
        return renderOrderStep();
      case 3:
        return renderTimingStep();
      case 4:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderBasicInfoStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Bundle Name *</Label>
        <Input
          id="name"
          placeholder="e.g., New Employee Onboarding Package"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          className={cn(errors.name && "border-destructive")}
        />
        {errors.name && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe what this bundle is for..."
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isRequired"
            checked={formData.isRequired}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, isRequired: checked as boolean }))
            }
          />
          <Label htmlFor="isRequired" className="font-normal">
            Required bundle (must be completed)
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowPartialComplete"
            checked={formData.allowPartialComplete}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, allowPartialComplete: checked as boolean }))
            }
          />
          <Label htmlFor="allowPartialComplete" className="font-normal">
            Allow partial completion (optional documents can be skipped)
          </Label>
        </div>
      </div>
    </div>
  );

  const renderDocumentsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select documents to include in this bundle
        </p>
        <Badge variant="secondary">{formData.items.length} selected</Badge>
      </div>

      {errors.items && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {errors.items}
        </p>
      )}

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {templates.map((template) => {
            const isSelected = formData.items.some((item) => item.templateId === template.id);
            return (
              <div
                key={template.id}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted/50"
                )}
                onClick={() => toggleTemplate(template.id)}
              >
                <Checkbox checked={isSelected} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{template.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {template.description || template.category}
                  </p>
                </div>
                <Badge variant="outline">{template.documentType}</Badge>
              </div>
            );
          })}

          {templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No templates available</p>
              <p className="text-sm">Create document templates first</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderOrderStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag to reorder documents. Toggle whether each document is required.
      </p>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {formData.items.map((item, index) => (
            <div
              key={item.templateId}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.template?.name || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">
                  {item.template?.category}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={item.isRequired}
                    onCheckedChange={() => toggleItemRequired(item.templateId)}
                  />
                  <Label className="text-sm font-normal">Required</Label>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.templateId)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}

          {formData.items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No documents selected</p>
              <p className="text-sm">Go back to select documents</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Move buttons for accessibility */}
      <div className="flex justify-center gap-2">
        <p className="text-xs text-muted-foreground">
          Tip: Documents are completed in order from top to bottom
        </p>
      </div>
    </div>
  );

  const renderTimingStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Due Date</Label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasDueDate"
              checked={formData.dueWithinDays !== null}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  dueWithinDays: checked ? 14 : null,
                }))
              }
            />
            <Label htmlFor="hasDueDate" className="font-normal">
              Set due date
            </Label>
          </div>

          {formData.dueWithinDays !== null && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={formData.dueWithinDays}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    dueWithinDays: parseInt(e.target.value) || null,
                  }))
                }
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">days after assignment</span>
            </div>
          )}
        </div>

        {errors.dueWithinDays && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.dueWithinDays}
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Reminders</Label>
        </div>

        <p className="text-sm text-muted-foreground">
          Send reminders before the due date
        </p>

        <div className="grid grid-cols-2 gap-3">
          {REMINDER_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={cn(
                "flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors",
                formData.reminderDays.includes(option.value)
                  ? "bg-primary/10 border-primary"
                  : "hover:bg-muted/50"
              )}
              onClick={() => toggleReminder(option.value)}
            >
              <Checkbox checked={formData.reminderDays.includes(option.value)} />
              <Label className="font-normal cursor-pointer">{option.label}</Label>
            </div>
          ))}
        </div>

        {formData.reminderDays.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No reminders selected. Users won't receive due date reminders.
          </p>
        )}
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{formData.name}</h3>
          {formData.description && (
            <p className="text-muted-foreground mt-1">{formData.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>{CATEGORIES.find((c) => c.value === formData.category)?.label}</Badge>
          {formData.isRequired && <Badge variant="secondary">Required</Badge>}
          {formData.allowPartialComplete && (
            <Badge variant="outline">Partial completion allowed</Badge>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documents ({formData.items.length})
        </h4>
        <div className="space-y-2">
          {formData.items.map((item, index) => (
            <div key={item.templateId} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-6">{index + 1}.</span>
              <span className="flex-1">{item.template?.name || "Unknown"}</span>
              {item.isRequired ? (
                <Badge variant="secondary" className="text-xs">Required</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Optional</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Timing
        </h4>
        <div className="text-sm space-y-1">
          {formData.dueWithinDays !== null ? (
            <p>Due <strong>{formData.dueWithinDays} days</strong> after assignment</p>
          ) : (
            <p className="text-muted-foreground">No due date set</p>
          )}
          {formData.reminderDays.length > 0 && (
            <p className="text-muted-foreground">
              Reminders: {formData.reminderDays.map((d) =>
                d === 0 ? "on due date" : `${d} days before`
              ).join(", ")}
            </p>
          )}
        </div>
      </div>

      {errors.submit && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {errors.submit}
        </p>
      )}
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Document Bundle</CardTitle>
        <CardDescription>
          Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].description}
        </CardDescription>
      </CardHeader>

      {/* Progress Steps */}
      <div className="px-6 pb-4">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  index < currentStep
                    ? "bg-primary text-primary-foreground"
                    : index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-12 h-0.5 mx-2",
                    index < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <CardContent className="min-h-[400px]">
        {renderStepContent()}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handleBack}
          disabled={isSubmitting}
        >
          {currentStep === 0 ? (
            <>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </>
          )}
        </Button>

        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Bundle
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default BundleCreationWizard;
