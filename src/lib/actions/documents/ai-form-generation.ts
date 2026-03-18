'use server';

import { FormSchema, FormField } from '@/lib/types/form-schema';
import OpenAI from 'openai';
import { readFile } from 'fs/promises';
import path from 'path';
import { researchFormRequirements, ResearchResult, ResearchOptions, isResearchEnabledSync } from '@/lib/services/web-research-service';
import { 
  detectFormCategory, 
  getComplianceRules, 
  getRequiredFields, 
  getProhibitedFields,
  getRequiredNotices,
  FormCategory,
  Region
} from '@/lib/documents/compliance-rules';

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ResearchMetadata {
  /** Whether research was performed */
  enabled: boolean;
  /** Research result if performed */
  result?: ResearchResult;
  /** Form category detected */
  category?: FormCategory;
  /** Region used for compliance */
  region?: Region;
  /** Built-in compliance rules applied */
  complianceRulesApplied: string[];
  /** Time taken for research (ms) */
  researchDuration?: number;
}

export interface GenerateFormWithResearchOptions {
  name?: string;
  /** Enable web research (default: false) */
  enableResearch?: boolean;
  /** Industry context */
  industry?: string;
  /** Geographic region for compliance */
  region?: Region;
  /** Research depth */
  researchDepth?: 'quick' | 'standard' | 'comprehensive';
}

// ============================================================================
// Helper to get OpenAI client
// ============================================================================

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set, AI form generation will not work');
    return null;
  }
  return new OpenAI({ apiKey });
}

// ============================================================================
// Helper to read PDF content (handles both URLs and local paths)
// ============================================================================

async function getPDFBuffer(pdfUrl: string): Promise<ArrayBuffer> {
  // Check if it's a local path (starts with /uploads or is a relative path)
  if (pdfUrl.startsWith('/uploads/') || pdfUrl.startsWith('/public/')) {
    // It's a local file - read from filesystem
    const filePath = path.join(process.cwd(), 'public', pdfUrl);
    const buffer = await readFile(filePath);
    return buffer.buffer as ArrayBuffer;
  }
  
  // Check if it's a full URL
  if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }
    return response.arrayBuffer();
  }
  
  // Assume it's a local path relative to public
  const filePath = path.join(process.cwd(), 'public', pdfUrl);
  const buffer = await readFile(filePath);
  return buffer.buffer as ArrayBuffer;
}

// ============================================================================
// Generate Form from PDF URL
// ============================================================================

interface GenerateFormFromPDFOptions {
  name?: string;
  fileName?: string;
}

export async function generateFormFromPDF(
  pdfUrl: string,
  options?: GenerateFormFromPDFOptions
): Promise<ActionResult<FormSchema>> {
  try {
    // 1. Get PDF content (handles both URLs and local paths)
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await getPDFBuffer(pdfUrl);
    } catch (fetchError) {
      console.error('Error reading PDF:', fetchError);
      return { success: false, error: 'Failed to read PDF file' };
    }
    
    // 2. First, try to extract existing fillable fields with pdf-lib
    const { extractPDFFormFields } = await import('@/lib/documents/pdf-field-extraction');
    
    let existingFields: Awaited<ReturnType<typeof extractPDFFormFields>> = [];
    try {
      existingFields = await extractPDFFormFields(arrayBuffer);
    } catch (e) {
      console.log('No existing fillable fields found in PDF');
    }
    
    // 3. If we have fillable fields, convert them directly
    if (existingFields.length > 0) {
      const formFields: FormField[] = existingFields.map((field, index) => ({
        id: `field_${Date.now()}_${index}`,
        type: mapPDFTypeToFieldType(field.type),
        label: field.name || `Field ${index + 1}`,
        required: field.required || false,
        placeholder: '',
        validation: [],
        options: field.options?.map(opt => ({
          value: opt.value,
          label: opt.label,
        })),
      }));
      
      const schema = createSchemaFromFields(formFields, options?.name || 'Generated Form');
      return { success: true, data: schema };
    }
    
    // 4. For non-fillable PDFs, use GPT-4o Vision to detect form fields
    const { detectFormFieldsFromPDF } = await import('@/lib/documents/pdf-text-extraction');
    
    const detectionResult = await detectFormFieldsFromPDF(
      arrayBuffer,
      options?.fileName || options?.name
    );
    
    if (!detectionResult.fields || detectionResult.fields.length === 0) {
      return { success: false, error: 'No fields could be detected in the PDF' };
    }
    
    // 5. Create form schema from detected fields
    const schema: FormSchema = {
      id: `form_${Date.now()}`,
      version: 1,
      name: options?.name || detectionResult.documentTitle || 'Generated Form',
      description: detectionResult.documentDescription,
      fields: detectionResult.fields,
      settings: {
        layout: detectionResult.fields.length > 10 ? 'multiStep' : 'single',
        showProgress: true,
        allowSave: true,
        autoSave: true,
        autoSaveInterval: 30000,
        submission: {
          submitLabel: 'Submit',
          clearOnSubmit: false,
          requireConfirmation: true,
          confirmMessage: 'Are you sure you want to submit this form?',
        },
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'gpt-4o-pdf-analysis',
        updatedBy: 'gpt-4o-pdf-analysis',
        version: 1,
      },
    };
    
    return { success: true, data: schema };
  } catch (error) {
    console.error('Error generating form from PDF:', error);
    return { success: false, error: 'Failed to generate form from PDF' };
  }
}

// ============================================================================
// Generate Form from Description
// ============================================================================

interface GenerateFormFromDescriptionOptions {
  name?: string;
}

export async function generateFormFromDescription(
  description: string,
  options?: GenerateFormFromDescriptionOptions
): Promise<ActionResult<FormSchema>> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return { 
      success: false, 
      error: 'AI service is not available. Please set OPENAI_API_KEY environment variable.' 
    };
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a form schema generator. Generate a complete form schema based on the user's description.

Return ONLY a valid JSON object with this structure (no markdown, no code blocks):
{
  "name": "Form name",
  "description": "Form description",
  "fields": [
    {
      "id": "unique_id",
      "type": "text|textarea|number|email|phone|date|time|select|multiselect|radio|checkbox|toggle|file|image|signature",
      "label": "Field label",
      "placeholder": "Placeholder text",
      "required": true or false,
      "options": [{"value": "value", "label": "Label"}]
    }
  ]
}

Guidelines:
- Use appropriate field types for each piece of information
- Mark essential fields as required
- Add helpful placeholders
- For choices, use select, radio, or checkbox with options
- Group related fields logically
- Include all fields mentioned in the description
- Create sensible field IDs using underscores`
        },
        {
          role: 'user',
          content: description
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.7,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'Empty response from AI' };
    }
    
    const parsed = JSON.parse(content);
    
    // Create a proper FormSchema from the parsed response
    const schema: FormSchema = {
      id: `form_${Date.now()}`,
      version: 1,
      name: parsed.name || options?.name || 'Generated Form',
      description: parsed.description,
      fields: (parsed.fields || []).map((field: any, index: number) => ({
        id: field.id || `field_${Date.now()}_${index}`,
        type: field.type || 'text',
        label: field.label || `Field ${index + 1}`,
        placeholder: field.placeholder || '',
        required: field.required || false,
        validation: [],
        options: field.options,
        appearance: {
          width: 'full' as const,
          labelPosition: 'top' as const,
        },
      })),
      settings: {
        layout: 'single',
        showProgress: true,
        allowSave: true,
        autoSave: true,
        autoSaveInterval: 30000,
        submission: {
          submitLabel: 'Submit',
          clearOnSubmit: false,
          requireConfirmation: true,
          confirmMessage: 'Are you sure you want to submit this form?',
        },
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'ai',
        updatedBy: 'ai',
        version: 1,
      },
    };
    
    return { success: true, data: schema };
  } catch (error) {
    console.error('Error generating form from description:', error);
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Failed to parse AI response' };
    }
    return { success: false, error: 'Failed to generate form' };
  }
}

// ============================================================================
// Generate Form from Description with Research
// ============================================================================

export interface FormSchemaWithMetadata extends FormSchema {
  researchMetadata?: ResearchMetadata;
}

export async function generateFormFromDescriptionWithResearch(
  description: string,
  options?: GenerateFormWithResearchOptions
): Promise<ActionResult<FormSchemaWithMetadata>> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return { 
      success: false, 
      error: 'AI service is not available. Please set OPENAI_API_KEY environment variable.' 
    };
  }
  
  const {
    name,
    enableResearch = false, // Disabled by default
    industry,
    region = 'AU',
    researchDepth = 'standard'
  } = options || {};
  
  // Initialize metadata
  const metadata: ResearchMetadata = {
    enabled: enableResearch,
    region,
    complianceRulesApplied: []
  };
  
  let researchResult: ResearchResult | null = null;
  
  // Step 1: Detect form category
  const category = detectFormCategory(description);
  metadata.category = category;
  
  console.log('[AI Form Gen] Detected category:', category);
  
  // Step 2: Get built-in compliance rules
  const complianceRules = getComplianceRules(category, region);
  const requiredFields = getRequiredFields(category, region);
  const prohibitedFields = getProhibitedFields(category, region);
  const requiredNotices = getRequiredNotices(category, region);
  
  if (complianceRules) {
    metadata.complianceRulesApplied = complianceRules.rules.map(r => r.name);
  }
  
  // Step 3: Perform web research if enabled
  if (enableResearch && isResearchEnabledSync()) {
    const researchStart = Date.now();
    
    try {
      researchResult = await researchFormRequirements(description, {
        includeCompliance: true,
        includeBestPractices: true,
        industry,
        region,
        depth: researchDepth
      });
      
      metadata.researchDuration = Date.now() - researchStart;
      metadata.result = researchResult;
      
      console.log('[AI Form Gen] Research completed in', metadata.researchDuration, 'ms');
    } catch (error) {
      console.error('[AI Form Gen] Research failed:', error);
      // Continue without research results
    }
  }
  
  // Step 4: Build enhanced prompt with research and compliance
  const systemPrompt = buildEnhancedSystemPrompt({
    researchResult,
    requiredFields,
    prohibitedFields,
    requiredNotices,
    category,
    region
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      temperature: 0.7,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'Empty response from AI' };
    }
    
    const parsed = JSON.parse(content);
    
    // Create a proper FormSchema from the parsed response
    const schema: FormSchemaWithMetadata = {
      id: `form_${Date.now()}`,
      version: 1,
      name: parsed.name || name || 'Generated Form',
      description: parsed.description,
      fields: (parsed.fields || []).map((field: any, index: number) => ({
        id: field.id || `field_${Date.now()}_${index}`,
        type: field.type || 'text',
        label: field.label || `Field ${index + 1}`,
        placeholder: field.placeholder || '',
        description: field.description,
        helpText: field.helpText,
        required: field.required || false,
        validation: field.validation || [],
        options: field.options,
        appearance: {
          width: 'full' as const,
          labelPosition: 'top' as const,
        },
      })),
      settings: {
        layout: (parsed.fields || []).length > 10 ? 'multiStep' : 'single',
        showProgress: true,
        allowSave: true,
        autoSave: true,
        autoSaveInterval: 30000,
        submission: {
          submitLabel: 'Submit',
          clearOnSubmit: false,
          requireConfirmation: true,
          confirmMessage: 'Are you sure you want to submit this form?',
        },
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: enableResearch ? 'ai-with-research' : 'ai',
        updatedBy: enableResearch ? 'ai-with-research' : 'ai',
        version: 1,
      },
      researchMetadata: metadata
    };
    
    return { success: true, data: schema };
  } catch (error) {
    console.error('Error generating form from description with research:', error);
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Failed to parse AI response' };
    }
    return { success: false, error: 'Failed to generate form' };
  }
}

/**
 * Build enhanced system prompt with research and compliance context
 */
function buildEnhancedSystemPrompt(context: {
  researchResult: ResearchResult | null;
  requiredFields: string[];
  prohibitedFields: string[];
  requiredNotices: string[];
  category: FormCategory;
  region: Region;
}): string {
  const { researchResult, requiredFields, prohibitedFields, requiredNotices, category, region } = context;
  
  let prompt = `You are a form schema generator. Generate a complete form schema based on the user's description.

Return ONLY a valid JSON object with this structure (no markdown, no code blocks):
{
  "name": "Form name",
  "description": "Form description",
  "fields": [
    {
      "id": "unique_id",
      "type": "text|textarea|number|email|phone|date|time|select|multiselect|radio|checkbox|toggle|file|image|signature",
      "label": "Field label",
      "placeholder": "Placeholder text",
      "description": "Field description",
      "helpText": "Help text for users",
      "required": true or false,
      "validation": [{"type": "required|email|phone", "message": "Error message"}],
      "options": [{"value": "value", "label": "Label"}]
    }
  ]
}

Form Context:
- Category: ${category}
- Region: ${region}

`;

  // Add compliance requirements
  if (requiredFields.length > 0) {
    prompt += `
REQUIRED FIELDS (must include these):
${requiredFields.map(f => `- ${f}`).join('\n')}

`;
  }
  
  if (prohibitedFields.length > 0) {
    prompt += `
PROHIBITED FIELDS (do NOT include these):
${prohibitedFields.map(f => `- ${f}`).join('\n')}

`;
  }
  
  if (requiredNotices.length > 0) {
    prompt += `
REQUIRED NOTICES (include as info fields or help text):
${requiredNotices.map(n => `- ${n}`).join('\n')}

`;
  }
  
  // Add research findings
  if (researchResult && researchResult.success) {
    prompt += `
RESEARCH FINDINGS:
${researchResult.summary}

Key Facts:
${researchResult.keyFacts.map(f => `- ${f}`).join('\n')}

Compliance Requirements:
${researchResult.complianceRequirements.map(r => `- ${r}`).join('\n')}

Industry Standards:
${researchResult.industryStandards.map(s => `- ${s}`).join('\n')}

Recommended Fields:
${researchResult.recommendedFields.map(f => `- ${f}`).join('\n')}

`;
  }
  
  prompt += `
Guidelines:
- Use appropriate field types for each piece of information
- Mark essential fields as required
- Add helpful placeholders and descriptions
- For choices, use select, radio, or checkbox with options
- Group related fields logically
- Include all fields mentioned in the description
- Create sensible field IDs using underscores
- Consider accessibility in field labels and help text`;
  
  return prompt;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapPDFTypeToFieldType(pdfType: string): FormField['type'] {
  const mapping: Record<string, FormField['type']> = {
    text: 'text',
    textarea: 'textarea',
    number: 'number',
    email: 'email',
    phone: 'phone',
    date: 'date',
    time: 'time',
    checkbox: 'checkbox',
    radio: 'radio',
    dropdown: 'select',
    select: 'select',
    signature: 'signature',
    file: 'file',
    button: 'text', // Default to text
    unknown: 'text',
  };
  
  return mapping[pdfType] || 'text';
}

function createSchemaFromFields(fields: FormField[], name: string): FormSchema {
  return {
    id: `form_${Date.now()}`,
    version: 1,
    name,
    description: undefined,
    fields,
    settings: {
      layout: 'single',
      showProgress: true,
      allowSave: true,
      autoSave: true,
      autoSaveInterval: 30000,
      submission: {
        submitLabel: 'Submit',
        clearOnSubmit: false,
        requireConfirmation: true,
        confirmMessage: 'Are you sure you want to submit this form?',
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'pdf-import',
      updatedBy: 'pdf-import',
      version: 1,
    },
  };
}
