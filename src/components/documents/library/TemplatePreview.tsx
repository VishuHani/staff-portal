"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Type,
  Hash,
  Mail,
  Phone,
  Calendar,
  Clock,
  List,
  CheckSquare,
  ToggleLeft,
  Upload,
  Image,
  PenTool,
  Minus,
  Heading,
  FileText as FileTextIcon,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateLibraryItemWithRelations } from "@/lib/actions/documents/library";

// ============================================================================
// Types
// ============================================================================

interface TemplatePreviewProps {
  template: TemplateLibraryItemWithRelations;
}

interface FormField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  helpText?: string;
  content?: string;
  options?: { value: string; label: string }[];
  validation?: { type: string; message: string }[];
}

interface FormSchema {
  id: string;
  version: number;
  name: string;
  fields: FormField[];
  settings?: {
    layout?: string;
    showProgress?: boolean;
    allowSave?: boolean;
  };
}

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  textarea: FileText,
  number: Hash,
  email: Mail,
  phone: Phone,
  date: Calendar,
  time: Clock,
  datetime: Calendar,
  select: List,
  multiselect: ListChecks,
  radio: List,
  checkbox: CheckSquare,
  toggle: ToggleLeft,
  file: Upload,
  image: Image,
  signature: PenTool,
  divider: Minus,
  header: Heading,
  paragraph: FileTextIcon,
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text Input",
  textarea: "Text Area",
  number: "Number",
  email: "Email",
  phone: "Phone",
  date: "Date",
  time: "Time",
  datetime: "Date & Time",
  select: "Dropdown",
  multiselect: "Multi-Select",
  radio: "Radio Buttons",
  checkbox: "Checkbox",
  toggle: "Toggle",
  file: "File Upload",
  image: "Image Upload",
  signature: "Signature",
  divider: "Divider",
  header: "Section Header",
  paragraph: "Paragraph",
};

// ============================================================================
// Component
// ============================================================================

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Parse form schema
  const formSchema = useMemo<FormSchema | null>(() => {
    if (!template.formSchema) return null;
    try {
      return template.formSchema as unknown as FormSchema;
    } catch {
      return null;
    }
  }, [template.formSchema]);

  // Get form config
  const formConfig = useMemo(() => {
    if (!template.formConfig) return {};
    return template.formConfig as Record<string, unknown>;
  }, [template.formConfig]);

  // Count fields by type
  const fieldCounts = useMemo(() => {
    if (!formSchema?.fields) return {};
    
    const counts: Record<string, number> = {};
    formSchema.fields.forEach((field) => {
      if (field.type !== "divider" && field.type !== "header" && field.type !== "paragraph") {
        counts[field.type] = (counts[field.type] || 0) + 1;
      }
    });
    return counts;
  }, [formSchema]);

  // Get requirements
  const requirements = useMemo(() => {
    const reqs: string[] = [];
    
    if (formConfig.requireSignature) {
      reqs.push("Signature required");
    }
    if (formConfig.allowAttachments) {
      reqs.push("Attachments allowed");
    }
    if (template.documentType === "PDF") {
      reqs.push("PDF document");
    }
    if (template.documentType === "FORM") {
      reqs.push("Digital form");
    }
    if (template.documentType === "HYBRID") {
      reqs.push("PDF with form overlay");
    }
    
    return reqs;
  }, [formConfig, template.documentType]);

  // Get selected field
  const selectedField = useMemo(() => {
    if (!selectedFieldId || !formSchema?.fields) return null;
    return formSchema.fields.find((f) => f.id === selectedFieldId);
  }, [selectedFieldId, formSchema]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[500px]">
      {/* Field List */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Form Fields</span>
              {formSchema?.fields && (
                <Badge variant="secondary">
                  {formSchema.fields.filter((f) => !["divider", "header", "paragraph"].includes(f.type)).length} fields
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {formSchema?.fields ? (
                <div className="space-y-1 p-4 pt-0">
                  {formSchema.fields.map((field, index) => {
                    const Icon = FIELD_TYPE_ICONS[field.type] || FileText;
                    const isLayoutField = ["divider", "header", "paragraph"].includes(field.type);
                    
                    if (isLayoutField) {
                      return (
                        <div key={field.id} className="py-2">
                          {field.type === "divider" && <Separator />}
                          {field.type === "header" && (
                            <p className="text-lg font-semibold text-muted-foreground">
                              {field.label}
                            </p>
                          )}
                          {field.type === "paragraph" && (
                            <p className="text-sm text-muted-foreground">
                              {field.content || field.label}
                            </p>
                          )}
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={field.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedFieldId === field.id
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted/50 border border-transparent"
                        )}
                        onClick={() => setSelectedFieldId(field.id)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{field.label}</p>
                            {field.required && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {FIELD_TYPE_LABELS[field.type] || field.type}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No form schema available</p>
                  <p className="text-sm text-center mt-2">
                    This template may be a PDF document without interactive form fields.
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Details Panel */}
      <div className="space-y-4">
        {/* Template Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Document Type</p>
              <p className="font-medium">{template.documentType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Category</p>
              <p className="font-medium">{template.category}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Jurisdiction</p>
              <p className="font-medium">{template.jurisdiction}</p>
            </div>
            {template.stateSpecific && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">State/Region</p>
                <p className="font-medium">{template.stateSpecific}</p>
              </div>
            )}
            {template.isOfficial && (
              <div className="flex items-center gap-2 text-primary">
                <Badge variant="default">Official Government Form</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements */}
        {requirements.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    {req}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Field Type Summary */}
        {Object.keys(fieldCounts).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Field Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(fieldCounts).map(([type, count]) => {
                  const Icon = FIELD_TYPE_ICONS[type] || FileText;
                  return (
                    <Badge key={type} variant="secondary" className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {FIELD_TYPE_LABELS[type] || type}: {count}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Field Details */}
        {selectedField && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Field Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Label</p>
                <p className="font-medium">{selectedField.label}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p>{FIELD_TYPE_LABELS[selectedField.type] || selectedField.type}</p>
              </div>
              {selectedField.placeholder && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Placeholder</p>
                  <p className="text-sm">{selectedField.placeholder}</p>
                </div>
              )}
              {selectedField.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedField.description}</p>
                </div>
              )}
              {selectedField.helpText && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Help Text</p>
                  <p className="text-sm">{selectedField.helpText}</p>
                </div>
              )}
              {selectedField.options && selectedField.options.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Options</p>
                  <div className="space-y-1">
                    {selectedField.options.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedField.validation && selectedField.validation.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Validation</p>
                  <div className="space-y-1">
                    {selectedField.validation.map((v, i) => (
                      <Badge key={i} variant="outline" className="mr-1">
                        {v.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default TemplatePreview;
