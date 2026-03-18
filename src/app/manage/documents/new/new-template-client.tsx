"use client";

import { useState, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  FileText,
  Upload,
  Wand2,
  Save,
  Loader2,
  Building2,
  Sparkles,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { FormBuilder } from "@/components/documents/form-builder/FormBuilder";
import { PDFUploader } from "@/components/documents/pdf/PDFUploader";
import { createDocumentTemplate } from "@/lib/actions/documents/templates";
import { FormSchema, createNewSchema } from "@/lib/types/form-schema";
import { ExtractedPDFField } from "@/lib/documents/pdf-types";
import { ResearchPanel } from "@/components/documents/form-builder/ResearchPanel";
import { ResearchResult } from "@/lib/services/web-research-service";
import { FormCategory, Region } from "@/lib/documents/compliance-rules";

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface NewDocumentTemplateClientProps {
  venues: Venue[];
  defaultVenueId: string | null;
}

type DocumentCreationMode = "form" | "pdf" | "ai";

export function NewDocumentTemplateClient({
  venues,
  defaultVenueId,
}: NewDocumentTemplateClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DocumentCreationMode>("form");
  const [selectedVenueId, setSelectedVenueId] = useState<string>(defaultVenueId || venues[0]?.id || "");
  const [isSaving, setIsSaving] = useState(false);

  // Template settings
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [isRequired, setIsRequired] = useState(true);
  const [requireSignature, setRequireSignature] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [instructions, setInstructions] = useState("");

  // Form schema
  const [formSchema, setFormSchema] = useState<FormSchema>(createNewSchema());

  // PDF state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [detectedFields, setDetectedFields] = useState<ExtractedPDFField[]>([]);
  const [isGeneratingFromPDF, setIsGeneratingFromPDF] = useState(false);

  // AI state
  const [aiDescription, setAiDescription] = useState("");
  const [isGeneratingFromAI, setIsGeneratingFromAI] = useState(false);

  // Research state
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [researchRegion, setResearchRegion] = useState<Region>("AU");
  const [researchDepth, setResearchDepth] = useState<"quick" | "standard" | "comprehensive">("standard");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<FormCategory | undefined>();
  const [complianceRulesApplied, setComplianceRulesApplied] = useState<string[]>([]);
  const [researchDuration, setResearchDuration] = useState<number | undefined>();

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

    if (!selectedVenueId) {
      toast.error("Please select a venue");
      return;
    }

    if (mode === "form" && formSchema.fields.length === 0) {
      toast.error("Please add at least one field to the form");
      return;
    }

    if (mode === "pdf" && !pdfUrl) {
      toast.error("Please upload a PDF file");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createDocumentTemplate(selectedVenueId, {
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
        toast.success("Template created successfully");
        router.push("/manage/documents");
      } else {
        toast.error(result.error || "Failed to create template");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    } finally {
      setIsSaving(false);
    }
  }, [name, description, category, selectedVenueId, mode, formSchema, pdfUrl, pdfFileName, isRequired, requireSignature, allowDownload, instructions, router]);

  const handlePDFUpload = useCallback((result: { url: string; fileName: string; fileSize: number; documentInfo?: unknown; formFields?: ExtractedPDFField[] }) => {
    setPdfUrl(result.url);
    setPdfFileName(result.fileName);
    
    // Store detected form fields from PDF
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
      // Dynamic import to avoid circular dependencies
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
    setResearchResult(null);
    setDetectedCategory(undefined);
    setComplianceRulesApplied([]);
    setResearchDuration(undefined);
    
    try {
      // Dynamic import to avoid circular dependencies
      const { generateFormFromDescriptionWithResearch } = await import("@/lib/actions/documents/ai-form-generation");
      const result = await generateFormFromDescriptionWithResearch(aiDescription, {
        name: name || "Generated Form",
        enableResearch: researchEnabled,
        region: researchRegion,
        researchDepth: researchDepth
      });
      
      if (result.success && result.data) {
        setFormSchema(result.data);
        setMode("form");
        
        // Update research metadata if available
        if (result.data.researchMetadata) {
          setResearchResult(result.data.researchMetadata.result || null);
          setDetectedCategory(result.data.researchMetadata.category);
          setComplianceRulesApplied(result.data.researchMetadata.complianceRulesApplied);
          setResearchDuration(result.data.researchMetadata.researchDuration);
        }
        
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
  }, [aiDescription, name, researchEnabled, researchRegion, researchDepth]);

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
              <h1 className="text-2xl font-bold tracking-tight">New Document Template</h1>
              <p className="text-sm text-muted-foreground">
                Create a new document template for your venue
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
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
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
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
                      <PDFUploader
                        venueId={selectedVenueId}
                        onUploadComplete={handlePDFUpload}
                      />
                      
                      {/* Detected Fields Preview */}
                      {detectedFields.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Detected Fields ({detectedFields.length})</h4>
                            <Badge variant="secondary">Fillable PDF</Badge>
                          </div>
                          <ScrollArea className="h-[200px] border rounded-lg p-3">
                            <div className="space-y-2">
                              {detectedFields.map((field) => (
                                <div key={field.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
                                  <span className="text-sm font-medium">{field.name}</span>
                                  <Badge variant="outline" className="text-xs">{field.type}</Badge>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
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
                      
                      {/* AI Analysis Option */}
                      {pdfUrl && detectedFields.length === 0 && (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                          <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-medium mb-1">No Fillable Fields Detected</h4>
                              <p className="text-sm text-muted-foreground mb-3">
                                This PDF doesn't have fillable form fields. Use AI to analyze the document structure and generate a form.
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
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                    {/* Main AI Generation Card */}
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
                          {researchEnabled ? "Generate with Research" : "Generate Form"}
                        </Button>
                        
                        {/* Example prompts */}
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

                    {/* Research Panel */}
                    <ResearchPanel
                      enabled={researchEnabled}
                      onEnabledChange={setResearchEnabled}
                      region={researchRegion}
                      onRegionChange={setResearchRegion}
                      depth={researchDepth}
                      onDepthChange={setResearchDepth}
                      isResearching={isGeneratingFromAI && researchEnabled}
                      researchResult={researchResult}
                      category={detectedCategory}
                      complianceRulesApplied={complianceRulesApplied}
                      researchDuration={researchDuration}
                      isAvailable={true}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
