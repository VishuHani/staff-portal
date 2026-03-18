'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, ChevronRight, FileText, Sparkles, Upload, Wand2, ArrowLeft, Building2, ArrowRight, Loader2, Save, Lightbulb, Pencil, Globe } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FormSchema, createNewSchema } from '@/lib/types/form-schema';
import { FormBuilder } from '@/components/documents/form-builder/FormBuilder';
import { PDFUploader } from '@/components/documents/pdf/PDFUploader';
import { createDocumentTemplate } from '@/lib/actions/documents/templates';
import { PromptTemplateSelector } from './PromptTemplateSelector';
import { PromptTemplate } from '@/lib/documents/ai-prompt-templates';
import { ResearchPanel } from '@/components/documents/form-builder/ResearchPanel';
import { ResearchResult } from '@/lib/services/web-research-service';
import { FormCategory, Region } from '@/lib/documents/compliance-rules';
import { PrintFillDocumentUploader } from '@/components/documents/print-fill/PrintFillDocumentUploader';
import { FillablePdfBuilder } from '@/components/documents/fillable-pdf/FillablePdfBuilder';
import { FormFieldDefinition } from '@/lib/services/fillable-pdf-service';

// Types
type WizardStep = 'documentType' | 'method' | 'settings' | 'build' | 'review';
type CreationMethod = 'form' | 'pdf' | 'ai' | 'printFill' | 'fillablePdf';
type DocumentType = 'form' | 'editablePdf' | 'printPdf';

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface FormCreationWizardProps {
  venues: Venue[];
  defaultVenueId: string | null;
}

// Constants
const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'documentType', label: 'Document Type' },
  { id: 'method', label: 'Choose Method' },
  { id: 'settings', label: 'Settings' },
  { id: 'build', label: 'Build Form' },
  { id: 'review', label: 'Review' },
];

const DOCUMENT_TYPES = [
  {
    id: 'form',
    title: 'Create Form',
    description: 'Build a digital form that staff can fill out online',
    icon: '📝',
    bestFor: 'Digital forms, surveys, questionnaires, data collection',
    features: ['Drag & drop builder', 'Multiple field types', 'Validation rules', 'Digital signatures'],
    comingSoon: false,
  },
  {
    id: 'editablePdf',
    title: 'Create Editable PDF',
    description: 'Create a fillable PDF form with text fields, checkboxes, and more',
    icon: '📄',
    bestFor: 'Existing PDFs that need digital fillable fields',
    features: ['PDF overlay', 'Fillable fields', 'Preserves formatting', 'Digital signatures'],
    comingSoon: true,
  },
  {
    id: 'printPdf',
    title: 'Upload Print & Fill Document',
    description: 'Upload a PDF for staff to print, fill, and upload back',
    icon: '🖨️',
    bestFor: 'Documents that must be printed and signed physically',
    features: ['PDF upload', 'Print & sign workflow', 'AI verification', 'Status tracking'],
    comingSoon: false,
  },
];

const CATEGORIES = [
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'HR', label: 'HR Documents' },
  { value: 'CONTRACT', label: 'Contracts' },
  { value: 'GENERAL', label: 'General' },
];

const EXAMPLE_PROMPTS = [
  "Employee onboarding form with personal details and emergency contacts",
  "WHS safety acknowledgment form",
  "Bank account details collection form",
  "Leave request form with date pickers",
];

// Creation Method Card Component
interface CreationMethodCardProps {
  id: CreationMethod;
  title: string;
  description: string;
  icon: React.ReactNode;
  bestFor: string;
  time: string;
  isSelected: boolean;
  onClick: () => void;
}

function CreationMethodCard({ id, title, description, icon, bestFor, time, isSelected, onClick }: CreationMethodCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 ${isSelected ? 'border-primary bg-primary/5' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            {icon}
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium">Best for:</span>
            <span>{bestFor}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium">Time:</span>
            <span>{time}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Wizard Stepper Component
interface WizardStepperProps {
  currentStep: WizardStep;
  steps: { id: WizardStep; label: string }[];
}

function WizardStepper({ currentStep, steps }: WizardStepperProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              index < currentIndex
                ? 'bg-primary text-primary-foreground'
                : index === currentIndex
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {index < currentIndex ? <CheckCircle className="h-4 w-4" /> : index + 1}
          </div>
          <span className={`ml-2 text-sm ${index === currentIndex ? 'font-medium' : 'text-muted-foreground'}`}>
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

// Main Wizard Component
export function FormCreationWizard({ venues, defaultVenueId }: FormCreationWizardProps) {
  const router = useRouter();
  
  // State
  const [step, setStep] = useState<WizardStep>('documentType');
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<CreationMethod | null>(null);
  const [formSchema, setFormSchema] = useState<FormSchema>(createNewSchema());
  const [isSaving, setIsSaving] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [isGeneratingFromAI, setIsGeneratingFromAI] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [aiInputMode, setAiInputMode] = useState<'template' | 'custom'>('template');
  const [isExtractingPDFFields, setIsExtractingPDFFields] = useState(false);
  
  // Fillable PDF state
  const [fillablePdfFields, setFillablePdfFields] = useState<FormFieldDefinition[]>([]);
  
  // Research state
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [researchRegion, setResearchRegion] = useState<Region>('AU');
  const [researchDepth, setResearchDepth] = useState<'quick' | 'standard' | 'comprehensive'>('standard');
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<FormCategory | undefined>();
  const [complianceRulesApplied, setComplianceRulesApplied] = useState<string[]>([]);
  const [researchDuration, setResearchDuration] = useState<number | undefined>();
  
  // Template settings
  const [templateSettings, setTemplateSettings] = useState({
    venueId: defaultVenueId || venues[0]?.id || '',
    name: '',
    description: '',
    category: 'GENERAL',
    isRequired: true,
    requireSignature: false,
    allowDownload: true,
    instructions: '',
  });

  // Handlers
  const handleDocumentTypeSelect = useCallback((docType: DocumentType) => {
    // Show coming soon message for editablePdf
    if (docType === 'editablePdf') {
      toast.info('Editable PDF feature is under development and launching soon!');
      return;
    }
    
    setSelectedDocumentType(docType);
    
    // For printPdf, skip method selection and go directly to settings
    if (docType === 'printPdf') {
      setSelectedMethod('printFill');
      setStep('settings');
    } else {
      setStep('method');
    }
  }, []);

  const handleMethodSelect = useCallback((method: CreationMethod) => {
    setSelectedMethod(method);
    setStep('settings');
  }, []);

  const handleSettingsChange = useCallback((settings: Partial<typeof templateSettings>) => {
    setTemplateSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const handlePDFUpload = useCallback(async (result: { url: string; fileName: string; fileSize: number }) => {
    setPdfUrl(result.url);
    setPdfFileName(result.fileName);
    toast.success('PDF uploaded successfully. Extracting form fields...');
    
    // Extract fields from the PDF
    setIsExtractingPDFFields(true);
    try {
      const { generateFormFromPDF } = await import('@/lib/actions/documents/ai-form-generation');
      const extractResult = await generateFormFromPDF(result.url, { 
        name: templateSettings.name || 'Imported Form',
        fileName: result.fileName
      });
      
      if (extractResult.success && extractResult.data) {
        setFormSchema(extractResult.data);
        toast.success(`Extracted ${extractResult.data.fields.length} fields from PDF. You can edit them in the form builder.`);
      } else {
        // If extraction failed, create a basic schema with just a file upload field
        const basicSchema = createNewSchema();
        basicSchema.name = templateSettings.name || 'Imported Form';
        basicSchema.fields = [{
          id: `field_${Date.now()}`,
          type: 'file',
          label: 'Upload Completed Document',
          placeholder: 'Upload your completed document',
          required: true,
          validation: [],
        }];
        setFormSchema(basicSchema);
        toast.warning('Could not extract fields from PDF. A basic upload field has been added. You can add more fields in the form builder.');
      }
    } catch (error) {
      console.error('Error extracting PDF fields:', error);
      // Create a basic schema as fallback
      const basicSchema = createNewSchema();
      basicSchema.name = templateSettings.name || 'Imported Form';
      basicSchema.fields = [{
        id: `field_${Date.now()}`,
        type: 'file',
        label: 'Upload Completed Document',
        placeholder: 'Upload your completed document',
        required: true,
        validation: [],
      }];
      setFormSchema(basicSchema);
      toast.warning('Could not extract fields from PDF. A basic upload field has been added.');
    } finally {
      setIsExtractingPDFFields(false);
    }
  }, [templateSettings.name]);

  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setSelectedTemplateId(template.id);
  }, []);

  const handleUseTemplate = useCallback((template: PromptTemplate) => {
    setAiDescription(template.prompt);
    setSelectedTemplateId(template.id);
    setAiInputMode('custom');
    toast.success(`Using template: ${template.name}`);
  }, []);

  const handleGenerateFromAI = useCallback(async () => {
    if (!aiDescription.trim()) {
      toast.error('Please describe the form you want to create');
      return;
    }
    
    setIsGeneratingFromAI(true);
    setResearchResult(null);
    setDetectedCategory(undefined);
    setComplianceRulesApplied([]);
    setResearchDuration(undefined);
    
    try {
      const { generateFormFromDescriptionWithResearch } = await import('@/lib/actions/documents/ai-form-generation');
      const result = await generateFormFromDescriptionWithResearch(aiDescription, {
        name: templateSettings.name || 'Generated Form',
        enableResearch: researchEnabled,
        region: researchRegion,
        researchDepth: researchDepth
      });
      
      if (result.success && result.data) {
        setFormSchema(result.data);
        setStep('build');
        
        // Update research metadata if available
        if (result.data.researchMetadata) {
          setResearchResult(result.data.researchMetadata.result || null);
          setDetectedCategory(result.data.researchMetadata.category);
          setComplianceRulesApplied(result.data.researchMetadata.complianceRulesApplied);
          setResearchDuration(result.data.researchMetadata.researchDuration);
        }
        
        toast.success('Form generated! You can edit it in the form builder.');
      } else {
        toast.error(result.error || 'Failed to generate form');
      }
    } catch (error) {
      console.error('Error generating form:', error);
      toast.error('Failed to generate form');
    } finally {
      setIsGeneratingFromAI(false);
    }
  }, [aiDescription, templateSettings.name, researchEnabled, researchRegion, researchDepth]);

  const handleSave = useCallback(async () => {
    if (!templateSettings.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!templateSettings.venueId) {
      toast.error('Please select a venue');
      return;
    }

    // For PDF/printFill methods, we don't require form fields - the PDF itself is the document
    // For form/AI methods, we require at least one field
    if (!['pdf', 'printFill', 'fillablePdf'].includes(selectedMethod || '') && formSchema.fields.length === 0) {
      toast.error('Please add at least one field to the form');
      return;
    }

    // For printFill, require a PDF to be uploaded
    if (selectedMethod === 'printFill' && !pdfUrl) {
      toast.error('Please upload a PDF document');
      return;
    }

    // For fillablePdf, require at least one field
    if (selectedMethod === 'fillablePdf' && fillablePdfFields.length === 0) {
      toast.error('Please add at least one field to the fillable PDF');
      return;
    }

    setIsSaving(true);
    try {
      // For fillable PDFs, we need to generate the PDF first
      let finalPdfUrl = pdfUrl;
      let finalPdfFileName = pdfFileName;
      
      if (selectedMethod === 'fillablePdf' && fillablePdfFields.length > 0) {
        // Generate the fillable PDF
        const response = await fetch('/api/documents/fillable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: templateSettings.name.trim(),
            fields: fillablePdfFields,
            venueId: templateSettings.venueId,
            options: { pageSize: 'letter' },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate fillable PDF');
        }

        const data = await response.json();
        if (data.success && data.pdfUrl) {
          finalPdfUrl = data.pdfUrl;
          finalPdfFileName = data.fileName;
        } else {
          throw new Error(data.error || 'Failed to generate fillable PDF');
        }
      }

      const result = await createDocumentTemplate(templateSettings.venueId, {
        name: templateSettings.name.trim(),
        description: templateSettings.description.trim() || undefined,
        category: templateSettings.category,
        documentType: ['pdf', 'printFill', 'fillablePdf'].includes(selectedMethod || '') ? 'PDF' : 'FORM',
        formSchema: formSchema.fields.length > 0 ? formSchema as unknown as Record<string, unknown> : undefined,
        pdfUrl: finalPdfUrl || undefined,
        pdfFileName: finalPdfFileName || undefined,
        isRequired: templateSettings.isRequired,
        requireSignature: templateSettings.requireSignature,
        allowDownload: templateSettings.allowDownload,
        instructions: templateSettings.instructions.trim() || undefined,
        isPrintOnly: selectedMethod === 'printFill',
      });

      if (result.success && result.data) {
        toast.success('Template created successfully');
        router.push('/manage/documents');
      } else {
        toast.error(result.error || 'Failed to create template');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    } finally {
      setIsSaving(false);
    }
  }, [templateSettings, formSchema, selectedMethod, pdfUrl, pdfFileName, fillablePdfFields, router]);

  const handleBack = useCallback(() => {
    const stepOrder: WizardStep[] = ['documentType', 'method', 'settings', 'build', 'review'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  }, [step]);

  const handleNext = useCallback(() => {
    const stepOrder: WizardStep[] = ['documentType', 'method', 'settings', 'build', 'review'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  }, [step]);

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'documentType':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">What would you like to create?</h2>
              <p className="text-muted-foreground mt-2">
                Choose the type of document you want to create
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
              {DOCUMENT_TYPES.map((docType) => (
                <Card
                  key={docType.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 relative ${
                    selectedDocumentType === docType.id ? 'border-primary bg-primary/5' : ''
                  } ${docType.comingSoon ? 'opacity-75' : ''}`}
                  onClick={() => handleDocumentTypeSelect(docType.id as DocumentType)}
                >
                  {docType.comingSoon && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">Under Development - Launching Soon</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{docType.icon}</div>
                      <div>
                        <CardTitle className="text-lg">{docType.title}</CardTitle>
                        <CardDescription className="text-sm">{docType.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="font-medium shrink-0">Best for:</span>
                        <span>{docType.bestFor}</span>
                      </div>
                      <div className="space-y-1">
                        {docType.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>💡 <strong>Tip:</strong> Digital forms are the most versatile option. They work great on mobile devices and automatically save progress.</p>
            </div>
          </div>
        );

      case 'method':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Create Document Template</h2>
              <p className="text-muted-foreground mt-2">
                Choose how you would like to create your document
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
              <CreationMethodCard
                id="form"
                title="Build Form"
                description="Start from scratch"
                icon={<FileText className="h-5 w-5" />}
                bestFor="Custom forms, simple layouts"
                time="5-10 minutes"
                isSelected={selectedMethod === 'form'}
                onClick={() => handleMethodSelect('form')}
              />
              <CreationMethodCard
                id="pdf"
                title="Upload PDF"
                description="Import existing form"
                icon={<Upload className="h-5 w-5" />}
                bestFor="Converting paper forms"
                time="2-5 minutes"
                isSelected={selectedMethod === 'pdf'}
                onClick={() => handleMethodSelect('pdf')}
              />
              <CreationMethodCard
                id="ai"
                title="AI Generate"
                description="Describe what you need"
                icon={<Sparkles className="h-5 w-5" />}
                bestFor="Complex forms, quick setup"
                time="1-2 minutes"
                isSelected={selectedMethod === 'ai'}
                onClick={() => handleMethodSelect('ai')}
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>💡 <strong>Tip:</strong> You can combine methods - upload a PDF and use AI to enhance it, or start with AI and customize manually.</p>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Template Settings</h2>
              <p className="text-muted-foreground mt-2">
                Configure your template before building the form
              </p>
            </div>
            
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="venue">Venue</Label>
                    {venues.length === 1 ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{venues[0].name}</span>
                        <Badge variant="outline" className="text-xs">{venues[0].code}</Badge>
                      </div>
                    ) : (
                      <Select value={templateSettings.venueId} onValueChange={(v) => handleSettingsChange({ venueId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a venue" />
                        </SelectTrigger>
                        <SelectContent>
                          {venues.map((venue) => (
                            <SelectItem key={venue.id} value={venue.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <span>{venue.name}</span>
                                <Badge variant="outline" className="text-xs">{venue.code}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name *</Label>
                    <Input
                      id="name"
                      value={templateSettings.name}
                      onChange={(e) => handleSettingsChange({ name: e.target.value })}
                      placeholder="e.g., WHS Safety Form"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={templateSettings.description}
                    onChange={(e) => handleSettingsChange({ description: e.target.value })}
                    placeholder="Brief description of this document..."
                    rows={2}
                  />
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={templateSettings.category} onValueChange={(v) => handleSettingsChange({ category: v })}>
                      <SelectTrigger>
                        <SelectValue />
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
                  
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="required" className="text-sm">Required</Label>
                      <Switch
                        id="required"
                        checked={templateSettings.isRequired}
                        onCheckedChange={(checked) => handleSettingsChange({ isRequired: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signature" className="text-sm">Require Signature</Label>
                      <Switch
                        id="signature"
                        checked={templateSettings.requireSignature}
                        onCheckedChange={(checked) => handleSettingsChange({ requireSignature: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="download" className="text-sm">Allow Download</Label>
                      <Switch
                        id="download"
                        checked={templateSettings.allowDownload}
                        onCheckedChange={(checked) => handleSettingsChange({ allowDownload: checked })}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={templateSettings.instructions}
                    onChange={(e) => handleSettingsChange({ instructions: e.target.value })}
                    placeholder="Instructions shown to staff when completing this document..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={!templateSettings.venueId || !templateSettings.name}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'build':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Build Your Form</h2>
                <p className="text-muted-foreground mt-1">
                  {selectedMethod === 'form' && 'Drag fields from the palette to build your form'}
                  {selectedMethod === 'pdf' && 'Upload a PDF to extract form fields'}
                  {selectedMethod === 'ai' && 'Describe your form and let AI create it'}
                </p>
              </div>
              <Badge variant="outline">{formSchema.fields.length} fields</Badge>
            </div>
            
            {selectedMethod === 'pdf' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload PDF Document</CardTitle>
                    <CardDescription>
                      Upload a PDF and we'll detect form fields automatically
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PDFUploader
                      venueId={templateSettings.venueId}
                      onUploadComplete={handlePDFUpload}
                    />
                  </CardContent>
                </Card>
                
                {isExtractingPDFFields && (
                  <Card className="border-primary/20">
                    <CardContent className="py-6">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                          <p className="font-medium">Extracting form fields from PDF...</p>
                          <p className="text-sm text-muted-foreground">This may take a moment</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {pdfUrl && !isExtractingPDFFields && formSchema.fields.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium">PDF uploaded and {formSchema.fields.length} fields extracted</span>
                      </div>
                      <Badge variant="outline">{formSchema.fields.length} fields</Badge>
                    </div>
                    <div className="min-h-[500px] border rounded-lg overflow-hidden">
                      <FormBuilder
                        initialSchema={formSchema}
                        onSave={(schema) => {
                          setFormSchema(schema);
                          toast.success('Form schema updated');
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {pdfUrl && !isExtractingPDFFields && formSchema.fields.length === 0 && (
                  <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="py-4">
                      <p className="text-sm">
                        No fields could be extracted from the PDF. You can still use this as a PDF template, 
                        or add fields manually in the form builder below.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            {selectedMethod === 'ai' && (
              <div className="space-y-4">
                <Tabs value={aiInputMode} onValueChange={(v) => setAiInputMode(v as 'template' | 'custom')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="template" className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Use Template
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Custom Description
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="template" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5" />
                          Choose a Template
                        </CardTitle>
                        <CardDescription>
                          Select from pre-built Australian workplace form templates
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PromptTemplateSelector
                          selectedTemplateId={selectedTemplateId}
                          onSelectTemplate={handleSelectTemplate}
                          onUseTemplate={handleUseTemplate}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="custom" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                      {/* Main AI Generation Card */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5" />
                            Describe Your Form
                          </CardTitle>
                          <CardDescription>
                            Describe the document you want to create and AI will generate it for you
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Textarea
                            value={aiDescription}
                            onChange={(e) => setAiDescription(e.target.value)}
                            placeholder="Describe the document you want to create... e.g., 'Create an employee onboarding form with personal details, emergency contacts, and bank information'"
                            rows={8}
                            className="resize-none"
                          />
                          <Button 
                            onClick={handleGenerateFromAI}
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
                          
                          <div className="space-y-2 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">Quick examples:</p>
                            <div className="flex flex-wrap gap-2">
                              {EXAMPLE_PROMPTS.map((example) => (
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
                
                {formSchema.fields.length > 0 && (
                  <div className="min-h-[500px] border rounded-lg overflow-hidden">
                    <FormBuilder
                      initialSchema={formSchema}
                      onSave={(schema) => {
                        setFormSchema(schema);
                        toast.success('Form schema updated');
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            
            {selectedMethod === 'form' && (
              <div className="min-h-[500px] border rounded-lg overflow-hidden">
                <FormBuilder
                  initialSchema={formSchema}
                  onSave={(schema) => {
                    setFormSchema(schema);
                    toast.success('Form schema saved');
                  }}
                />
              </div>
            )}
            
            {selectedMethod === 'printFill' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Print & Fill Document</CardTitle>
                    <CardDescription>
                      Upload a PDF that staff will print, fill by hand, and upload back for AI verification
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PrintFillDocumentUploader
                      venueId={templateSettings.venueId}
                      onUploadComplete={(result) => {
                        setPdfUrl(result.url);
                        setPdfFileName(result.fileName);
                        toast.success('Document uploaded successfully');
                      }}
                    />
                  </CardContent>
                </Card>
                
                {pdfUrl && (
                  <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">Document ready for Print & Fill workflow</p>
                          <p className="text-sm text-muted-foreground">
                            Staff will be able to download, print, fill, and upload this document for AI verification
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            {selectedMethod === 'fillablePdf' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Create Fillable PDF</CardTitle>
                    <CardDescription>
                      Add form fields to create a fillable PDF document
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FillablePdfBuilder
                      venueId={templateSettings.venueId}
                      initialFields={fillablePdfFields}
                      onFieldsChange={(fields) => {
                        setFillablePdfFields(fields);
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={() => setStep('review')} 
                disabled={
                  (selectedMethod === 'form' && formSchema.fields.length === 0) ||
                  (selectedMethod === 'ai' && formSchema.fields.length === 0) ||
                  (selectedMethod === 'pdf' && !pdfUrl) ||
                  (selectedMethod === 'printFill' && !pdfUrl) ||
                  (selectedMethod === 'fillablePdf' && fillablePdfFields.length === 0) ||
                  isExtractingPDFFields
                }
              >
                Review Template
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Review Your Template</h2>
                <p className="text-muted-foreground mt-1">
                  Review your template settings before saving
                </p>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Template Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{templateSettings.name || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="font-medium">{templateSettings.description || 'No description'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline">{CATEGORIES.find(c => c.value === templateSettings.category)?.label}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Venue:</span>
                    <span className="font-medium">{venues.find(v => v.id === templateSettings.venueId)?.name || 'Not selected'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="secondary">{selectedMethod === 'pdf' ? 'PDF Document' : 'Digital Form'}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Required:</span>
                    <Badge variant={templateSettings.isRequired ? 'default' : 'secondary'}>
                      {templateSettings.isRequired ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signature:</span>
                    <Badge variant={templateSettings.requireSignature ? 'default' : 'secondary'}>
                      {templateSettings.requireSignature ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedMethod === 'pdf' ? 'PDF Document' : `Form Fields (${formSchema.fields.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedMethod === 'pdf' ? (
                    <div className="space-y-3">
                      {pdfFileName && (
                        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{pdfFileName}</p>
                            <p className="text-xs text-muted-foreground">PDF uploaded</p>
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      )}
                      {formSchema.fields.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Extracted Fields ({formSchema.fields.length})</p>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {formSchema.fields.map((field) => (
                              <div key={field.id} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{field.label}</span>
                                  <Badge variant="outline" className="text-xs">{field.type}</Badge>
                                </div>
                                {field.required && (
                                  <Badge variant="secondary" className="text-xs">Required</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No form fields extracted. Staff will be able to view and download the PDF.
                        </p>
                      )}
                    </div>
                  ) : formSchema.fields.length === 0 ? (
                    <p className="text-muted-foreground">No fields added yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {formSchema.fields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.label}</span>
                            <Badge variant="outline" className="text-xs">{field.type}</Badge>
                          </div>
                          {field.required && (
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/manage/documents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">New Document Template</h1>
            <p className="text-sm text-muted-foreground">
              Create a new document template for your venue
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="border-b bg-background p-4 flex-shrink-0">
        <WizardStepper currentStep={step} steps={STEPS} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}

export default FormCreationWizard;
