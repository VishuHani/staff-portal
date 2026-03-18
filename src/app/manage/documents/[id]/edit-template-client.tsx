"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  FileText,
  Upload,
  Wand2,
  Save,
  Loader2,
  Building2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { FormBuilder } from "@/components/documents/form-builder/FormBuilder";
import { PDFUploader } from "@/components/documents/pdf/PDFUploader";
import { updateDocumentTemplate } from "@/lib/actions/documents/templates";
import { FormSchema, createNewSchema } from "@/lib/types/form-schema";
import { ExtractedPDFField } from "@/lib/documents/pdf-types";
import { DocumentType } from "@prisma/client";

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface Template {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  documentType: DocumentType;
  pdfUrl: string | null;
  pdfFileName: string | null;
  pdfFileSize: number | null;
  formSchema: any;
  isRequired: boolean;
  allowDownload: boolean;
  requireSignature: boolean;
  instructions: string | null;
  isActive: boolean;
  _count?: {
    assignments: number;
  };
}

interface EditDocumentTemplateClientProps {
  template: Template;
  venues: Venue[];
}

type DocumentCreationMode = "form" | "pdf" | "ai";

export function EditDocumentTemplateClient({
  template,
  venues,
}: EditDocumentTemplateClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DocumentCreationMode>(
    template.documentType === "PDF" ? "pdf" : "form"
  );
  const [selectedVenueId, setSelectedVenueId] = useState<string>(template.venueId);
  const [isSaving, setIsSaving] = useState(false);

  // Template settings
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [category, setCategory] = useState(template.category);
  const [isRequired, setIsRequired] = useState(template.isRequired);
  const [requireSignature, setRequireSignature] = useState(template.requireSignature);
  const [allowDownload, setAllowDownload] = useState(template.allowDownload);
  const [instructions, setInstructions] = useState(template.instructions || "");

  // Form schema - parse from template
  const [formSchema, setFormSchema] = useState<FormSchema>(() => {
    if (template.formSchema) {
      // Handle both array format and object with fields property
      const rawSchema = template.formSchema;
      let fields: FormSchema['fields'] = [];
      
      if (Array.isArray(rawSchema)) {
        fields = rawSchema as FormSchema['fields'];
      } else if (rawSchema && typeof rawSchema === 'object' && 'fields' in rawSchema) {
        const rawFields = (rawSchema as Record<string, unknown>).fields;
        fields = Array.isArray(rawFields) ? (rawFields as FormSchema['fields']) : [];
      }
      
      return {
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
        },
      };
    }
    return createNewSchema();
  });

  // PDF state
  const [pdfUrl, setPdfUrl] = useState<string | null>(template.pdfUrl);
  const [pdfFileName, setPdfFileName] = useState<string | null>(template.pdfFileName);
  const [detectedFields, setDetectedFields] = useState<ExtractedPDFField[]>([]);
  const [isGeneratingFromPDF, setIsGeneratingFromPDF] = useState(false);

  // AI state
  const [aiDescription, setAiDescription] = useState("");
  const [isGeneratingFromAI, setIsGeneratingFromAI] = useState(false);

  const categories = [
    { value: "ONBOARDING", label: "Onboarding" },
    { value: "COMPLIANCE", label: "Compliance" },
    { value: "POLICY", label: "Policy" },
    { value: "HR", label: "HR Documents" },
    { value: "CONTRACT", label: "Contracts" },
    { value: "GENERAL", label: "General" },
  ];

  const examplePrompts = [
    "Employee onboarding form with personal details and emergency contacts",
    "WHS safety acknowledgment form",
    "Bank account details collection form",
    "Leave request form with date pickers",
  ];

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateDocumentTemplate({
        id: template.id,
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        documentType: mode === "pdf" ? "PDF" : "FORM",
        formSchema: mode === "form" ? formSchema as unknown as Record<string, unknown> : undefined,
        pdfUrl: mode === "pdf" ? pdfUrl || undefined : undefined,
        pdfFileName: mode === "pdf" ? pdfFileName || undefined : undefined,
        isRequired,
        requireSignature,
        allowDownload,
        instructions: instructions.trim() || undefined,
      });

      if (result.success && result.data) {
        toast.success("Template updated successfully");
        router.push("/manage/documents");
      } else {
        toast.error(result.error || "Failed to update template");
      }
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    } finally {
      setIsSaving(false);
    }
  }, [name, description, category, template.id, mode, formSchema, pdfUrl, pdfFileName, isRequired, requireSignature, allowDownload, instructions, router]);

  const handlePDFUpload = useCallback((result: { url: string; fileName: string; fileSize: number; documentInfo?: unknown; formFields?: ExtractedPDFField[] }) => {
    setPdfUrl(result.url);
    setPdfFileName(result.fileName);
    
    if (result.formFields && result.formFields.length > 0) {
      setDetectedFields(result.formFields);
      toast.success(`Detected ${result.formFields.length} form fields in the PDF`);
    } else {
      setDetectedFields([]);
      toast.info("No fillable fields detected. You can use AI to analyze the PDF structure.");
    }
  }, []);

  const handleGenerateFormFromPDF = useCallback(async () => {
    if (!pdfUrl) return;
    
    setIsGeneratingFromPDF(true);
    try {
      const { generateFormFromPDF } = await import("@/lib/actions/documents/ai-form-generation");
      const result = await generateFormFromPDF(pdfUrl, { name: name || "Generated Form" });
      
      if (result.success && result.data) {
        setFormSchema(result.data);
        setMode("form");
        toast.success("Form generated from PDF! You can edit it in the form builder.");
      } else {
        toast.error(result.error || "Failed to generate form from PDF");
      }
    } catch (error) {
      console.error("Error generating form from PDF:", error);
      toast.error("Failed to generate form from PDF");
    } finally {
      setIsGeneratingFromPDF(false);
    }
  }, [pdfUrl, name]);

  const handleGenerateFromDescription = useCallback(async () => {
    if (!aiDescription.trim()) {
      toast.error("Please describe the form you want to create");
      return;
    }
    
    setIsGeneratingFromAI(true);
    try {
      const { generateFormFromDescription } = await import("@/lib/actions/documents/ai-form-generation");
      const result = await generateFormFromDescription(aiDescription, { name: name || "Generated Form" });
      
      if (result.success && result.data) {
        setFormSchema(result.data);
        setMode("form");
        toast.success("Form generated! You can edit it in the form builder.");
      } else {
        toast.error(result.error || "Failed to generate form");
      }
    } catch (error) {
      console.error("Error generating form from description:", error);
      toast.error("Failed to generate form");
    } finally {
      setIsGeneratingFromAI(false);
    }
  }, [aiDescription, name]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/manage/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit Document Template</h1>
              <p className="text-sm text-muted-foreground">
                Modify template settings and form fields
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {template._count?.assignments ? (
              <Badge variant="secondary">
                {template._count.assignments} assignment{template._count.assignments !== 1 ? 's' : ''}
              </Badge>
            ) : null}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0">
          {/* Settings Panel */}
          <div className="border-r bg-muted/30 overflow-auto">
            <Card className="border-0 rounded-none h-full">
              <CardHeader className="sticky top-0 bg-card z-10">
                <CardTitle>Settings</CardTitle>
                <CardDescription>Configure your document template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Venue Selection */}
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId} disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>{venue.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {venue.code}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Venue cannot be changed after creation</p>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., WHS Safety Form"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this document..."
                    rows={3}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Settings */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="required" className="text-sm">Required</Label>
                    <Switch
                      id="required"
                      checked={isRequired}
                      onCheckedChange={setIsRequired}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signature" className="text-sm">Require Signature</Label>
                    <Switch
                      id="signature"
                      checked={requireSignature}
                      onCheckedChange={setRequireSignature}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="download" className="text-sm">Allow Download</Label>
                    <Switch
                      id="download"
                      checked={allowDownload}
                      onCheckedChange={setAllowDownload}
                    />
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Instructions</Label>
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Instructions shown to staff when completing this document..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="overflow-auto">
            <div className="p-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as DocumentCreationMode)}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="form" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Build Form</span>
                    <span className="sm:hidden">Form</span>
                  </TabsTrigger>
                  <TabsTrigger value="pdf" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    <span className="hidden sm:inline">AI Generate</span>
                    <span className="sm:hidden">AI</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="mt-0">
                  <div className="min-h-[500px] border rounded-lg overflow-hidden">
                    <FormBuilder
                      initialSchema={formSchema}
                      onSave={(schema) => {
                        setFormSchema(schema);
                        toast.success("Form schema saved");
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="pdf" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload PDF Document</CardTitle>
                      <CardDescription>
                        Upload a PDF and we'll detect form fields automatically
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pdfUrl && (
                        <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div className="flex-1">
                            <p className="font-medium">{pdfFileName || "Current PDF"}</p>
                            <p className="text-sm text-muted-foreground">Current uploaded file</p>
                          </div>
                        </div>
                      )}
                      
                      <PDFUploader
                        venueId={selectedVenueId}
                        onUploadComplete={handlePDFUpload}
                      />
                      
                      {detectedFields.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Detected Fields ({detectedFields.length})</h4>
                            <Badge variant="secondary">Fillable PDF</Badge>
                          </div>
                          <Button 
                            onClick={handleGenerateFormFromPDF}
                            disabled={isGeneratingFromPDF}
                            className="w-full"
                          >
                            {isGeneratingFromPDF ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4 mr-2" />
                            )}
                            Generate Form from Fields
                          </Button>
                        </div>
                      )}
                      
                      {pdfUrl && detectedFields.length === 0 && (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                          <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-medium mb-1">No Fillable Fields Detected</h4>
                              <p className="text-sm text-muted-foreground mb-3">
                                This PDF doesn't have fillable form fields. Use AI to analyze the document structure.
                              </p>
                              <Button 
                                onClick={handleGenerateFormFromPDF}
                                disabled={isGeneratingFromPDF}
                                variant="outline"
                              >
                                {isGeneratingFromPDF ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Wand2 className="h-4 w-4 mr-2" />
                                )}
                                Analyze PDF with AI
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="ai" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5" />
                        AI-Powered Form Generation
                      </CardTitle>
                      <CardDescription>
                        Describe the document you want to create and AI will generate a form for you.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        placeholder="Describe the document you want to create... e.g., 'Create an employee onboarding form with fields for personal details, emergency contacts, and bank account information'"
                        rows={6}
                        className="resize-none"
                      />
                      <Button 
                        onClick={handleGenerateFromDescription}
                        disabled={isGeneratingFromAI || !aiDescription.trim()}
                        className="w-full"
                      >
                        {isGeneratingFromAI ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4 mr-2" />
                        )}
                        Generate Form
                      </Button>
                      
                      <div className="space-y-2 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Try these examples:</p>
                        <div className="flex flex-wrap gap-2">
                          {examplePrompts.map((example) => (
                            <Button
                              key={example}
                              variant="outline"
                              size="sm"
                              onClick={() => setAiDescription(example)}
                            >
                              {example}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
