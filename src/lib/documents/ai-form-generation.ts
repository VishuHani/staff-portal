/**
 * AI Form Generation Service
 * 
 * This service converts detected PDF fields into a structured form schema
 * that can be used by the form builder. It uses AI to generate labels,
 * validation rules, and logical groupings.
 * 
 * Note: This is a library module, not a server actions file.
 * Server actions that use these functions should be in separate files with 'use server'.
 */

import OpenAI from "openai";
import {
  FORM_GENERATION_SYSTEM_PROMPT,
  generateFormGenerationPrompt,
  parseFormGenerationResponse,
  type AIDetectedField,
  type DocumentStructureAnalysis,
  type FormGenerationResult,
  type GeneratedFormSection,
  convertAIDetectedFieldToFormField,
} from "./ai-prompts";
import type { FormField, FormSchema, FieldType, FieldValidation, SelectOption } from "@/lib/types/form-schema";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * AI Configuration for form generation
 */
interface AIFormGenerationConfig {
  /** Model to use for generation */
  model: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature for AI responses */
  temperature: number;
  /** Confidence threshold for accepting generated fields */
  confidenceThreshold: number;
}

const DEFAULT_CONFIG: AIFormGenerationConfig = {
  model: "gpt-4o-mini",
  maxTokens: 4096,
  temperature: 0.2,
  confidenceThreshold: 0.6,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for form generation
 */
export interface FormGenerationOptions {
  /** Form name */
  name?: string;
  /** Form description */
  description?: string;
  /** Custom configuration */
  config?: Partial<AIFormGenerationConfig>;
  /** Skip AI generation and use rules only */
  skipAI?: boolean;
}

/**
 * Result of form generation from detected fields
 */
export interface FormGenerationOutput {
  /** Generated form schema */
  schema: FormSchema;
  /** Generation metadata */
  metadata: {
    generatedAt: Date;
    model: string;
    fieldCount: number;
    sectionCount: number;
    aiGenerated: boolean;
    confidence: number;
    warnings: string[];
  };
}

// ============================================================================
// AI FORM GENERATION
// ============================================================================

/**
 * Get OpenAI client instance
 */
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, form generation will use rules only");
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate form schema using AI
 */
async function generateFormWithAI(
  detectedFields: AIDetectedField[],
  documentStructure: DocumentStructureAnalysis,
  documentName: string,
  config: AIFormGenerationConfig
): Promise<FormGenerationResult | null> {
  const openai = getOpenAIClient();

  if (!openai) {
    return null;
  }

  const prompt = generateFormGenerationPrompt(
    detectedFields,
    documentStructure,
    documentName
  );

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: FORM_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = parseFormGenerationResponse(content);
    if (!parsed) {
      throw new Error("Failed to parse form generation response");
    }

    return parsed;
  } catch (error) {
    console.error("[AI Form Generation] Generation failed:", error);
    return null;
  }
}

// ============================================================================
// RULES-BASED FORM GENERATION (FALLBACK)
// ============================================================================

/**
 * Generate form schema using rules (no AI)
 */
function generateFormWithRules(
  detectedFields: AIDetectedField[],
  documentStructure: DocumentStructureAnalysis,
  documentName: string
): FormGenerationResult {
  const sections: GeneratedFormSection[] = [];
  const warnings: string[] = [];

  // Group fields by page or section
  const fieldsByPage = new Map<number, AIDetectedField[]>();
  
  for (const field of detectedFields) {
    const page = field.position.pageNumber;
    if (!fieldsByPage.has(page)) {
      fieldsByPage.set(page, []);
    }
    fieldsByPage.get(page)!.push(field);
  }

  // Create sections from document structure if available
  if (documentStructure.sections.length > 0) {
    for (const section of documentStructure.sections) {
      const sectionFields = detectedFields.filter(
        f => f.position.pageNumber === section.pageNumber
      );

      if (sectionFields.length > 0) {
        sections.push({
          id: `section_${sections.length + 1}`,
          title: section.title,
          description: undefined,
          fields: sectionFields.map(convertAIDetectedFieldToFormField),
          order: sections.length + 1,
        });
      }
    }
  } else {
    // Create sections by page
    for (const [pageNumber, fields] of fieldsByPage) {
      sections.push({
        id: `section_page_${pageNumber}`,
        title: `Page ${pageNumber}`,
        description: undefined,
        fields: fields.map(convertAIDetectedFieldToFormField),
        order: pageNumber,
      });
    }
  }

  // Flatten all fields
  const allFields = sections.flatMap(s => s.fields);

  // Add warnings for low confidence fields
  for (const field of detectedFields) {
    if (field.confidence < 0.5) {
      warnings.push(`Field "${field.label}" has low confidence (${(field.confidence * 100).toFixed(0)}%)`);
    }
  }

  return {
    name: documentName || "Generated Form",
    description: documentStructure.purpose || undefined,
    sections,
    fields: allFields,
    settings: {
      layout: sections.length > 3 ? "multiStep" : "single",
      showProgress: true,
      allowSave: true,
      autoSave: true,
    },
    confidence: 0.5,
    warnings,
  };
}

// ============================================================================
// MAIN FORM GENERATION FUNCTION
// ============================================================================

/**
 * Generate a form schema from detected fields
 */
export async function generateFormFromFields(
  detectedFields: AIDetectedField[],
  documentStructure: DocumentStructureAnalysis,
  documentName: string,
  options: FormGenerationOptions = {}
): Promise<FormGenerationOutput> {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const warnings: string[] = [];
  let aiGenerated = false;
  let confidence = 0.5;

  // Try AI generation first (unless skipped)
  let result: FormGenerationResult | null = null;
  
  if (!options.skipAI) {
    result = await generateFormWithAI(
      detectedFields,
      documentStructure,
      documentName,
      config
    );
    
    if (result) {
      aiGenerated = true;
      confidence = result.confidence;
      warnings.push(...(result.warnings || []));
    }
  }

  // Fall back to rules-based generation
  if (!result) {
    result = generateFormWithRules(detectedFields, documentStructure, documentName);
    warnings.push("AI generation unavailable, using rules-based generation");
  }

  // Override name and description if provided
  if (options.name) {
    result.name = options.name;
  }
  if (options.description) {
    result.description = options.description;
  }

  // Create the form schema
  const schema: FormSchema = {
    id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: 1,
    name: result.name,
    description: result.description,
    fields: result.fields,
    settings: {
      layout: result.settings.layout,
      showProgress: result.settings.showProgress,
      allowSave: result.settings.allowSave,
      autoSave: result.settings.autoSave,
      autoSaveInterval: 30000,
      submission: {
        submitLabel: "Submit",
        clearOnSubmit: false,
        requireConfirmation: true,
        confirmMessage: "Are you sure you want to submit this form?",
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      updatedBy: "system",
      version: 1,
    },
  };

  return {
    schema,
    metadata: {
      generatedAt: new Date(),
      model: aiGenerated ? config.model : "rules",
      fieldCount: result.fields.length,
      sectionCount: result.sections.length,
      aiGenerated,
      confidence,
      warnings,
    },
  };
}

// ============================================================================
// FIELD ENHANCEMENT FUNCTIONS
// ============================================================================

/**
 * Enhance a field with additional validation based on its type and label
 */
export function enhanceFieldValidation(field: FormField): FormField {
  const validation: FieldValidation[] = [...(field.validation || [])];
  const labelLower = field.label.toLowerCase();

  // Add email validation for email fields
  if (field.type === "email" || labelLower.includes("email")) {
    if (!validation.some(v => v.type === "email")) {
      validation.push({
        type: "email",
        message: "Please enter a valid email address",
      });
    }
  }

  // Add phone validation for phone fields
  if (field.type === "phone" || labelLower.includes("phone")) {
    if (!validation.some(v => v.type === "phone")) {
      validation.push({
        type: "phone",
        message: "Please enter a valid phone number",
      });
    }
  }

  // Add required validation for required fields
  if (field.required && !validation.some(v => v.type === "required")) {
    validation.unshift({
      type: "required",
      message: `${field.label} is required`,
    });
  }

  // Add date validation for date fields
  if (field.type === "date") {
    if (labelLower.includes("birth") || labelLower.includes("dob")) {
      // Date of birth - should be in the past
      field.maxDate = new Date().toISOString().split("T")[0];
    }
    if (labelLower.includes("expiry") || labelLower.includes("expiration")) {
      // Expiry date - should be in the future
      field.minDate = new Date().toISOString().split("T")[0];
    }
  }

  // Return enhanced field
  return {
    ...field,
    validation,
  };
}

/**
 * Generate smart defaults for a field based on its label
 */
export function generateSmartDefaults(field: FormField): FormField {
  const labelLower = field.label.toLowerCase();
  
  // Set placeholder based on field type/label
  if (!field.placeholder) {
    if (field.type === "email") {
      field.placeholder = "email@example.com";
    } else if (field.type === "phone") {
      field.placeholder = "+61 4XX XXX XXX";
    } else if (field.type === "date") {
      field.placeholder = "DD/MM/YYYY";
    } else if (labelLower.includes("name")) {
      field.placeholder = "Enter your name";
    } else if (labelLower.includes("address")) {
      field.placeholder = "Enter your address";
    }
  }

  // Set help text for complex fields
  if (!field.helpText) {
    if (labelLower.includes("tax file number") || labelLower.includes("tfn")) {
      field.helpText = "Your Tax File Number is confidential. Do not share it with unauthorized persons.";
    } else if (labelLower.includes("signature")) {
      field.helpText = "Please sign using your mouse or touch screen.";
    } else if (labelLower.includes("emergency contact")) {
      field.helpText = "Someone we can contact in case of emergency.";
    }
  }

  return field;
}

// ============================================================================
// FORM SCHEMA UTILITIES
// ============================================================================

/**
 * Validate a generated form schema
 */
export function validateFormSchema(schema: FormSchema): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!schema.id) {
    errors.push("Schema ID is required");
  }
  if (!schema.name) {
    errors.push("Schema name is required");
  }
  if (!Array.isArray(schema.fields)) {
    errors.push("Schema fields must be an array");
  }

  // Check for duplicate field IDs
  const fieldIds = new Set<string>();
  for (const field of schema.fields) {
    if (fieldIds.has(field.id)) {
      errors.push(`Duplicate field ID: ${field.id}`);
    }
    fieldIds.add(field.id);

    // Check field has required properties
    if (!field.id) {
      errors.push("Field missing ID");
    }
    if (!field.type) {
      errors.push(`Field ${field.id} missing type`);
    }
    if (!field.label) {
      warnings.push(`Field ${field.id} missing label, using ID as label`);
    }

    // Check select/radio fields have options
    if (["select", "multiselect", "radio"].includes(field.type)) {
      if (!field.options || field.options.length === 0) {
        warnings.push(`Field ${field.id} (${field.type}) has no options`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merge two form schemas
 */
export function mergeFormSchemas(
  base: FormSchema,
  override: Partial<FormSchema>
): FormSchema {
  return {
    ...base,
    ...override,
    fields: override.fields || base.fields,
    settings: {
      ...base.settings,
      ...override.settings,
    },
    metadata: {
      createdAt: base.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: base.metadata?.createdBy || "system",
      updatedBy: "system",
      version: (base.metadata?.version || 1) + 1,
      templateId: base.metadata?.templateId,
    },
  };
}

/**
 * Create a form schema from a list of fields
 */
export function createFormSchemaFromFields(
  fields: FormField[],
  name: string = "Untitled Form",
  description?: string
): FormSchema {
  return {
    id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: 1,
    name,
    description,
    fields,
    settings: {
      layout: fields.length > 10 ? "multiStep" : "single",
      showProgress: true,
      allowSave: true,
      autoSave: true,
      autoSaveInterval: 30000,
      submission: {
        submitLabel: "Submit",
        clearOnSubmit: false,
        requireConfirmation: true,
        confirmMessage: "Are you sure you want to submit this form?",
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      updatedBy: "system",
      version: 1,
    },
  };
}

// ============================================================================
// FIELD GROUPING UTILITIES
// ============================================================================

/**
 * Group fields into logical sections
 */
export function groupFieldsIntoSections(
  fields: FormField[],
  groupBy: "type" | "page" | "auto" = "auto"
): GeneratedFormSection[] {
  const sections: GeneratedFormSection[] = [];

  if (groupBy === "type") {
    // Group by field type
    const typeGroups = new Map<FieldType, FormField[]>();
    
    for (const field of fields) {
      const type = field.type;
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(field);
    }

    let order = 1;
    for (const [type, typeFields] of typeGroups) {
      sections.push({
        id: `section_${type}`,
        title: getFieldTypeName(type),
        fields: typeFields,
        order: order++,
      });
    }
  } else if (groupBy === "page") {
    // Group by page (if available in appearance)
    const pageGroups = new Map<number, FormField[]>();
    
    for (const field of fields) {
      // Extract page from field ID or default to 1
      const pageMatch = field.id.match(/page_(\d+)/);
      const page = pageMatch ? parseInt(pageMatch[1]) : 1;
      
      if (!pageGroups.has(page)) {
        pageGroups.set(page, []);
      }
      pageGroups.get(page)!.push(field);
    }

    for (const [page, pageFields] of pageGroups) {
      sections.push({
        id: `section_page_${page}`,
        title: `Page ${page}`,
        fields: pageFields,
        order: page,
      });
    }
  } else {
    // Auto grouping - use heuristics
    const personalInfoFields = fields.filter(f => 
      /name|email|phone|address|date of birth|dob/i.test(f.label)
    );
    const emergencyFields = fields.filter(f => 
      /emergency|contact/i.test(f.label)
    );
    const employmentFields = fields.filter(f => 
      /employment|position|role|start date|salary/i.test(f.label)
    );
    const signatureFields = fields.filter(f => 
      f.type === "signature" || /signature/i.test(f.label)
    );
    const otherFields = fields.filter(f => 
      !personalInfoFields.includes(f) &&
      !emergencyFields.includes(f) &&
      !employmentFields.includes(f) &&
      !signatureFields.includes(f)
    );

    let order = 1;

    if (personalInfoFields.length > 0) {
      sections.push({
        id: "section_personal",
        title: "Personal Information",
        fields: personalInfoFields,
        order: order++,
      });
    }

    if (emergencyFields.length > 0) {
      sections.push({
        id: "section_emergency",
        title: "Emergency Contact",
        fields: emergencyFields,
        order: order++,
      });
    }

    if (employmentFields.length > 0) {
      sections.push({
        id: "section_employment",
        title: "Employment Details",
        fields: employmentFields,
        order: order++,
      });
    }

    if (otherFields.length > 0) {
      sections.push({
        id: "section_other",
        title: "Additional Information",
        fields: otherFields,
        order: order++,
      });
    }

    if (signatureFields.length > 0) {
      sections.push({
        id: "section_signature",
        title: "Signature",
        fields: signatureFields,
        order: order++,
      });
    }
  }

  return sections;
}

/**
 * Get a human-readable name for a field type
 */
function getFieldTypeName(type: FieldType): string {
  const names: Record<FieldType, string> = {
    text: "Text Fields",
    textarea: "Text Areas",
    number: "Number Fields",
    email: "Email Fields",
    phone: "Phone Fields",
    date: "Date Fields",
    time: "Time Fields",
    datetime: "Date & Time Fields",
    select: "Dropdowns",
    multiselect: "Multi-Select Fields",
    radio: "Radio Buttons",
    checkbox: "Checkboxes",
    toggle: "Toggle Switches",
    file: "File Uploads",
    image: "Image Uploads",
    signature: "Signatures",
    divider: "Dividers",
    header: "Headers",
    paragraph: "Paragraphs",
    rating: "Rating Fields",
    scale: "Scale Fields",
    slider: "Slider Fields",
    calculation: "Calculation Fields",
    currency: "Currency Fields",
    percentage: "Percentage Fields",
    url: "URL Fields",
    matrix: "Matrix Fields",
    repeating_section: "Repeating Sections",
    page_break: "Page Breaks",
  };

  return names[type] || "Other Fields";
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Export form schema to JSON
 */
export function exportSchemaToJSON(schema: FormSchema): string {
  return JSON.stringify(schema, null, 2);
}

/**
 * Import form schema from JSON
 */
export function importSchemaFromJSON(json: string): FormSchema | null {
  try {
    const schema = JSON.parse(json) as FormSchema;
    const validation = validateFormSchema(schema);
    
    if (!validation.valid) {
      console.error("Schema validation errors:", validation.errors);
      return null;
    }
    
    return schema;
  } catch (error) {
    console.error("Failed to parse schema JSON:", error);
    return null;
  }
}