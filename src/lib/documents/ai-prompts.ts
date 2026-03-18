/**
 * AI Prompts for Document Analysis
 * 
 * This module contains structured prompts for AI-powered document analysis,
 * including field detection, structure analysis, change detection, and form generation.
 */

import type { FieldType, FormField, FieldValidation, SelectOption } from '@/lib/types/form-schema';

// ============================================================================
// PROMPT TYPES
// ============================================================================

/**
 * Document type classification
 */
export type DocumentType = 
  | 'form'
  | 'contract'
  | 'policy'
  | 'application'
  | 'report'
  | 'certificate'
  | 'agreement'
  | 'declaration'
  | 'other';

/**
 * Detected field type from AI analysis
 */
export type AIDetectedFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'checkbox'
  | 'signature'
  | 'select'
  | 'radio'
  | 'table'
  | 'unknown';

/**
 * Field detected by AI analysis
 */
export interface AIDetectedField {
  /** Unique identifier for the field */
  id: string;
  /** Field label extracted from document */
  label: string;
  /** Detected field type */
  type: AIDetectedFieldType;
  /** Approximate position on page (percentage-based) */
  position: {
    pageNumber: number;
    x: number; // 0-100 percentage
    y: number; // 0-100 percentage
    width: number; // 0-100 percentage
    height: number; // 0-100 percentage
  };
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether the field appears to be required */
  required: boolean;
  /** Detected validation rules */
  validation?: {
    type: string;
    message?: string;
  }[];
  /** Options for select/radio fields */
  options?: string[];
  /** Placeholder text if detected */
  placeholder?: string;
  /** Default value if detected */
  defaultValue?: string;
  /** Surrounding context for the field */
  context?: string;
}

/**
 * Document structure analysis result
 */
export interface DocumentStructureAnalysis {
  /** Detected document type */
  documentType: DocumentType;
  /** Document title or heading */
  title?: string;
  /** Overall purpose of the document */
  purpose?: string;
  /** Detected sections */
  sections: {
    title: string;
    pageNumber: number;
    startY: number; // Percentage
    fieldCount: number;
  }[];
  /** Legal or compliance indicators */
  complianceIndicators: string[];
  /** Whether document has fillable fields */
  hasFillableFields: boolean;
  /** Whether document requires signature */
  requiresSignature: boolean;
  /** Confidence score for the analysis */
  confidence: number;
}

/**
 * Field detection result
 */
export interface FieldDetectionResult {
  /** All detected fields */
  fields: AIDetectedField[];
  /** Existing form fields (if fillable PDF) */
  existingFields: {
    name: string;
    type: string;
    value?: string;
  }[];
  /** Detected signature areas */
  signatureAreas: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  }[];
  /** Detected tables */
  tables: {
    pageNumber: number;
    rows: number;
    columns: number;
    headers: string[];
  }[];
  /** Date fields detected */
  dateFields: AIDetectedField[];
  /** Checkbox groups detected */
  checkboxGroups: {
    label: string;
    options: string[];
    pageNumber: number;
  }[];
  /** Overall confidence score */
  overallConfidence: number;
}

/**
 * Change type for version comparison
 */
export type ChangeType = 'added' | 'removed' | 'modified' | 'moved';

/**
 * Impact level for changes
 */
export type ImpactLevel = 'breaking' | 'non-breaking' | 'neutral';

/**
 * Detected change between document versions
 */
export interface DetectedChange {
  /** Unique identifier for the change */
  id: string;
  /** Type of change */
  changeType: ChangeType;
  /** Field that changed (if applicable) */
  field?: {
    id: string;
    label: string;
    type: string;
  };
  /** Description of the change */
  description: string;
  /** Impact assessment */
  impact: ImpactLevel;
  /** Old value (for modified fields) */
  oldValue?: unknown;
  /** New value (for modified fields) */
  newValue?: unknown;
  /** Position information */
  position?: {
    pageNumber: number;
    x: number;
    y: number;
  };
  /** Recommendation for handling the change */
  recommendation: string;
}

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
  /** All detected changes */
  changes: DetectedChange[];
  /** Summary statistics */
  summary: {
    added: number;
    removed: number;
    modified: number;
    moved: number;
    breaking: number;
  };
  /** Whether the changes require template update */
  requiresUpdate: boolean;
  /** Overall confidence score */
  confidence: number;
}

/**
 * Generated form section
 */
export interface GeneratedFormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  order: number;
}

/**
 * Form generation result
 */
export interface FormGenerationResult {
  /** Generated form name */
  name: string;
  /** Form description */
  description?: string;
  /** Form sections */
  sections: GeneratedFormSection[];
  /** All fields (flattened) */
  fields: FormField[];
  /** Form settings */
  settings: {
    layout: 'single' | 'multiStep';
    showProgress: boolean;
    allowSave: boolean;
    autoSave: boolean;
  };
  /** Generation confidence */
  confidence: number;
  /** Warnings or notes from generation */
  warnings: string[];
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

/**
 * System prompt for document structure analysis
 */
export const STRUCTURE_DETECTION_SYSTEM_PROMPT = `You are an expert document analyst specializing in PDF structure analysis. Your task is to analyze documents and identify their structure, purpose, and key components.

Analyze the document and provide:
1. Document type classification (form, contract, policy, application, report, certificate, agreement, declaration, or other)
2. Document title or main heading
3. Overall purpose of the document
4. Logical sections and their positions
5. Legal or compliance indicators (e.g., "I agree", "signature required", "legal binding")
6. Whether the document has fillable form fields
7. Whether the document requires signatures

Be precise and thorough. Return your analysis as a valid JSON object.`;

/**
 * System prompt for field detection
 */
export const FIELD_DETECTION_SYSTEM_PROMPT = `You are an expert form field analyst. Your task is to analyze documents and identify all potential input fields, their types, positions, and validation requirements.

For each field you detect, identify:
1. Field label (what the field is asking for)
2. Likely field type (text, textarea, number, email, phone, date, time, checkbox, signature, select, radio)
3. Approximate position on the page (as percentages: x, y, width, height from 0-100)
4. Whether the field appears required or optional
5. Any validation rules you can infer (email format, phone format, date format, etc.)
6. For select/radio fields, identify the options
7. Surrounding context that helps understand the field's purpose

Also identify:
- Existing form fields (if the PDF is fillable)
- Tables with data entry areas
- Signature areas
- Date fields
- Checkbox groups

Return your analysis as a valid JSON object with all detected fields.`;

/**
 * System prompt for change detection
 */
export const CHANGE_DETECTION_SYSTEM_PROMPT = `You are an expert document comparison analyst. Your task is to compare two versions of a document and identify all changes between them.

For each change, identify:
1. Type of change: added, removed, modified, or moved
2. The field or element that changed
3. Description of what changed
4. Impact assessment:
   - "breaking": Change breaks existing form submissions or requires data migration
   - "non-breaking": Change is additive or cosmetic
   - "neutral": Change has no functional impact
5. Recommendation for handling the change

Focus on:
- Field additions/removals
- Label changes
- Type changes (e.g., text field changed to dropdown)
- Validation rule changes
- Position/layout changes
- Required/optional status changes

Return your analysis as a valid JSON object with all detected changes.`;

/**
 * System prompt for form generation
 */
export const FORM_GENERATION_SYSTEM_PROMPT = `You are an expert form designer. Your task is to convert detected document fields into a well-structured form schema.

For the generated form:
1. Create logical sections based on field groupings
2. Generate clear, user-friendly labels
3. Infer appropriate validation rules
4. Set required/optional status appropriately
5. Add helpful placeholder text where appropriate
6. Order fields logically for user completion
7. Consider accessibility and user experience

Return a complete form schema as a valid JSON object.`;

// ============================================================================
// USER PROMPTS
// ============================================================================

/**
 * Generate user prompt for structure detection
 */
export function generateStructureDetectionPrompt(
  documentText: string,
  pageCount: number,
  hasExistingFields: boolean
): string {
  return `Analyze this document and identify its structure and purpose.

Document Information:
- Total Pages: ${pageCount}
- Has Existing Form Fields: ${hasExistingFields ? 'Yes' : 'No'}

Document Content (extracted text):
${documentText}

Return a JSON object with your analysis containing:
{
  "documentType": "form|contract|policy|application|report|certificate|agreement|declaration|other",
  "title": "Document title or heading",
  "purpose": "Overall purpose of the document",
  "sections": [
    {
      "title": "Section title",
      "pageNumber": 1,
      "startY": 0,
      "fieldCount": 5
    }
  ],
  "complianceIndicators": ["List of legal/compliance phrases found"],
  "hasFillableFields": true/false,
  "requiresSignature": true/false,
  "confidence": 0.0-1.0
}`;
}

/**
 * Generate user prompt for field detection
 */
export function generateFieldDetectionPrompt(
  documentText: string,
  pageCount: number,
  structureInfo?: DocumentStructureAnalysis
): string {
  const structureContext = structureInfo
    ? `
Document Structure Context:
- Type: ${structureInfo.documentType}
- Title: ${structureInfo.title || 'Unknown'}
- Purpose: ${structureInfo.purpose || 'Unknown'}
- Sections: ${structureInfo.sections.map(s => s.title).join(', ')}
`
    : '';

  return `Analyze this document for input fields. Identify all potential fields where a user would need to enter information.

Document Information:
- Total Pages: ${pageCount}
${structureContext}

Document Content (extracted text):
${documentText}

Return a JSON object with your analysis containing:
{
  "fields": [
    {
      "id": "unique_field_id",
      "label": "Field label",
      "type": "text|textarea|number|email|phone|date|time|checkbox|signature|select|radio",
      "position": {
        "pageNumber": 1,
        "x": 0-100,
        "y": 0-100,
        "width": 0-100,
        "height": 0-100
      },
      "confidence": 0.0-1.0,
      "required": true/false,
      "validation": [
        {"type": "required|email|phone|date|pattern", "message": "Validation message"}
      ],
      "options": ["Option 1", "Option 2"],
      "placeholder": "Placeholder text",
      "defaultValue": "Default value",
      "context": "Surrounding context"
    }
  ],
  "existingFields": [
    {"name": "field_name", "type": "text", "value": "existing_value"}
  ],
  "signatureAreas": [
    {
      "pageNumber": 1,
      "x": 0-100,
      "y": 0-100,
      "width": 0-100,
      "height": 0-100,
      "label": "Signature label"
    }
  ],
  "tables": [
    {
      "pageNumber": 1,
      "rows": 5,
      "columns": 3,
      "headers": ["Column 1", "Column 2", "Column 3"]
    }
  ],
  "dateFields": [...],
  "checkboxGroups": [
    {
      "label": "Group label",
      "options": ["Option 1", "Option 2"],
      "pageNumber": 1
    }
  ],
  "overallConfidence": 0.0-1.0
}`;
}

/**
 * Generate user prompt for change detection
 */
export function generateChangeDetectionPrompt(
  originalText: string,
  newText: string,
  originalFields: AIDetectedField[],
  newFields: AIDetectedField[]
): string {
  return `Compare these two versions of a document and identify all changes.

=== ORIGINAL VERSION ===
${originalText}

Original Fields:
${JSON.stringify(originalFields, null, 2)}

=== NEW VERSION ===
${newText}

New Fields:
${JSON.stringify(newFields, null, 2)}

Return a JSON object with your analysis containing:
{
  "changes": [
    {
      "id": "unique_change_id",
      "changeType": "added|removed|modified|moved",
      "field": {
        "id": "field_id",
        "label": "Field label",
        "type": "field_type"
      },
      "description": "Description of the change",
      "impact": "breaking|non-breaking|neutral",
      "oldValue": "Previous value (if modified)",
      "newValue": "New value (if modified)",
      "position": {
        "pageNumber": 1,
        "x": 0-100,
        "y": 0-100
      },
      "recommendation": "How to handle this change"
    }
  ],
  "summary": {
    "added": 0,
    "removed": 0,
    "modified": 0,
    "moved": 0,
    "breaking": 0
  },
  "requiresUpdate": true/false,
  "confidence": 0.0-1.0
}`;
}

/**
 * Generate user prompt for form generation
 */
export function generateFormGenerationPrompt(
  detectedFields: AIDetectedField[],
  documentStructure: DocumentStructureAnalysis,
  documentName: string
): string {
  return `Convert these detected fields into a well-structured form schema.

Document Information:
- Name: ${documentName}
- Type: ${documentStructure.documentType}
- Purpose: ${documentStructure.purpose || 'Unknown'}

Detected Fields:
${JSON.stringify(detectedFields, null, 2)}

Document Sections:
${JSON.stringify(documentStructure.sections, null, 2)}

Return a JSON object with the generated form schema:
{
  "name": "Form name",
  "description": "Form description",
  "sections": [
    {
      "id": "section_id",
      "title": "Section title",
      "description": "Section description",
      "fields": [
        {
          "id": "field_id",
          "type": "text|textarea|number|email|phone|date|time|select|multiselect|radio|checkbox|toggle|file|image|signature",
          "label": "Field label",
          "placeholder": "Placeholder text",
          "description": "Field description",
          "helpText": "Help text for users",
          "required": true/false,
          "validation": [
            {"type": "required|min|max|minLength|maxLength|pattern|email|url|phone", "value": "validation_value", "message": "Error message"}
          ],
          "defaultValue": "Default value",
          "options": [
            {"value": "option_value", "label": "Option Label"}
          ],
          "appearance": {
            "width": "full|half|third|quarter",
            "labelPosition": "top|left|hidden",
            "placeholder": "Placeholder text",
            "helpText": "Help text"
          }
        }
      ],
      "order": 1
    }
  ],
  "fields": [...flattened list of all fields...],
  "settings": {
    "layout": "single|multiStep",
    "showProgress": true/false,
    "allowSave": true/false,
    "autoSave": true/false
  },
  "confidence": 0.0-1.0,
  "warnings": ["Any warnings or notes about the generation"]
}`;
}

// ============================================================================
// RESPONSE PARSING UTILITIES
// ============================================================================

/**
 * Parse JSON from AI response, handling potential formatting issues
 */
export function parseAIResponse<T>(response: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(response) as T;
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        // Continue to other methods
      }
    }

    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch {
        // Continue to other methods
      }
    }

    // Try to find JSON array in the response
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {
        // Give up
      }
    }

    console.error('Failed to parse AI response as JSON');
    return null;
  }
}

/**
 * Parse structure detection response
 */
export function parseStructureDetectionResponse(response: string): DocumentStructureAnalysis | null {
  const parsed = parseAIResponse<DocumentStructureAnalysis>(response);
  
  if (!parsed) return null;

  // Validate and sanitize
  return {
    documentType: parsed.documentType || 'other',
    title: parsed.title || undefined,
    purpose: parsed.purpose || undefined,
    sections: (parsed.sections || []).map((section, index) => ({
      title: section.title || `Section ${index + 1}`,
      pageNumber: section.pageNumber || 1,
      startY: section.startY || 0,
      fieldCount: section.fieldCount || 0,
    })),
    complianceIndicators: parsed.complianceIndicators || [],
    hasFillableFields: parsed.hasFillableFields ?? false,
    requiresSignature: parsed.requiresSignature ?? false,
    confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
  };
}

/**
 * Parse field detection response
 */
export function parseFieldDetectionResponse(response: string): FieldDetectionResult | null {
  const parsed = parseAIResponse<FieldDetectionResult>(response);
  
  if (!parsed) return null;

  // Validate and sanitize fields
  const fields: AIDetectedField[] = (parsed.fields || []).map((field, index) => ({
    id: field.id || `field_${index}`,
    label: field.label || `Field ${index + 1}`,
    type: field.type || 'text',
    position: {
      pageNumber: field.position?.pageNumber || 1,
      x: Math.min(100, Math.max(0, field.position?.x || 0)),
      y: Math.min(100, Math.max(0, field.position?.y || 0)),
      width: Math.min(100, Math.max(0, field.position?.width || 50)),
      height: Math.min(100, Math.max(0, field.position?.height || 10)),
    },
    confidence: Math.min(1, Math.max(0, field.confidence || 0.5)),
    required: field.required ?? false,
    validation: field.validation || [],
    options: field.options,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    context: field.context,
  }));

  return {
    fields,
    existingFields: parsed.existingFields || [],
    signatureAreas: (parsed.signatureAreas || []).map(area => ({
      pageNumber: area.pageNumber || 1,
      x: Math.min(100, Math.max(0, area.x || 0)),
      y: Math.min(100, Math.max(0, area.y || 0)),
      width: Math.min(100, Math.max(0, area.width || 30)),
      height: Math.min(100, Math.max(0, area.height || 10)),
      label: area.label,
    })),
    tables: parsed.tables || [],
    dateFields: (parsed.dateFields || []).map((field, index) => ({
      id: field.id || `date_field_${index}`,
      label: field.label || `Date Field ${index + 1}`,
      type: 'date' as const,
      position: {
        pageNumber: field.position?.pageNumber || 1,
        x: Math.min(100, Math.max(0, field.position?.x || 0)),
        y: Math.min(100, Math.max(0, field.position?.y || 0)),
        width: Math.min(100, Math.max(0, field.position?.width || 50)),
        height: Math.min(100, Math.max(0, field.position?.height || 10)),
      },
      confidence: Math.min(1, Math.max(0, field.confidence || 0.5)),
      required: field.required ?? false,
    })),
    checkboxGroups: parsed.checkboxGroups || [],
    overallConfidence: Math.min(1, Math.max(0, parsed.overallConfidence || 0.5)),
  };
}

/**
 * Parse change detection response
 */
export function parseChangeDetectionResponse(response: string): ChangeDetectionResult | null {
  const parsed = parseAIResponse<ChangeDetectionResult>(response);
  
  if (!parsed) return null;

  // Validate and sanitize changes
  const changes: DetectedChange[] = (parsed.changes || []).map((change, index) => ({
    id: change.id || `change_${index}`,
    changeType: change.changeType || 'modified',
    field: change.field,
    description: change.description || 'Unknown change',
    impact: change.impact || 'neutral',
    oldValue: change.oldValue,
    newValue: change.newValue,
    position: change.position ? {
      pageNumber: change.position.pageNumber || 1,
      x: Math.min(100, Math.max(0, change.position.x || 0)),
      y: Math.min(100, Math.max(0, change.position.y || 0)),
    } : undefined,
    recommendation: change.recommendation || 'Review and update as needed',
  }));

  const summary = parsed.summary || {
    added: changes.filter(c => c.changeType === 'added').length,
    removed: changes.filter(c => c.changeType === 'removed').length,
    modified: changes.filter(c => c.changeType === 'modified').length,
    moved: changes.filter(c => c.changeType === 'moved').length,
    breaking: changes.filter(c => c.impact === 'breaking').length,
  };

  return {
    changes,
    summary,
    requiresUpdate: parsed.requiresUpdate ?? (summary.breaking > 0),
    confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
  };
}

/**
 * Parse form generation response
 */
export function parseFormGenerationResponse(response: string): FormGenerationResult | null {
  const parsed = parseAIResponse<FormGenerationResult>(response);
  
  if (!parsed) return null;

  // Validate and sanitize sections
  const sections: GeneratedFormSection[] = (parsed.sections || []).map((section, index) => ({
    id: section.id || `section_${index}`,
    title: section.title || `Section ${index + 1}`,
    description: section.description,
    fields: (section.fields || []).map(sanitizeFormField),
    order: section.order ?? index,
  }));

  // Flatten all fields
  const allFields = sections.flatMap(s => s.fields);

  return {
    name: parsed.name || 'Generated Form',
    description: parsed.description,
    sections,
    fields: allFields,
    settings: {
      layout: parsed.settings?.layout || 'single',
      showProgress: parsed.settings?.showProgress ?? true,
      allowSave: parsed.settings?.allowSave ?? true,
      autoSave: parsed.settings?.autoSave ?? true,
    },
    confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    warnings: parsed.warnings || [],
  };
}

/**
 * Sanitize a form field from AI response
 */
function sanitizeFormField(field: FormField, index: number): FormField {
  return {
    id: field.id || `field_${index}`,
    type: field.type || 'text',
    label: field.label || `Field ${index + 1}`,
    placeholder: field.placeholder,
    description: field.description,
    helpText: field.helpText,
    required: field.required ?? false,
    validation: (field.validation || []).map(v => ({
      type: v.type || 'required',
      value: v.value,
      message: v.message || 'Invalid value',
    })),
    defaultValue: field.defaultValue,
    options: field.options?.map(o => ({
      value: o.value || o.label || '',
      label: o.label || o.value || '',
      disabled: o.disabled,
    })),
    appearance: {
      width: field.appearance?.width || 'full',
      labelPosition: field.appearance?.labelPosition || 'top',
      placeholder: field.appearance?.placeholder,
      helpText: field.appearance?.helpText,
    },
  };
}

// ============================================================================
// FALLBACK PROMPTS (for when AI is unavailable)
// ============================================================================

/**
 * Fallback field detection using regex patterns
 */
export function fallbackFieldDetection(documentText: string): FieldDetectionResult {
  const fields: AIDetectedField[] = [];
  let fieldIndex = 0;

  // Common field patterns
  const patterns = [
    // Name fields
    { regex: /(?:full\s+name|name)[:\s]*([^\n]+)/gi, type: 'text' as AIDetectedFieldType, label: 'Full Name' },
    // Email fields
    { regex: /(?:email|e-mail)[:\s]*([^\n]+)/gi, type: 'email' as AIDetectedFieldType, label: 'Email Address' },
    // Phone fields
    { regex: /(?:phone|telephone|mobile|cell)[:\s]*([^\n]+)/gi, type: 'phone' as AIDetectedFieldType, label: 'Phone Number' },
    // Date fields
    { regex: /(?:date|dob|date\s+of\s+birth)[:\s]*([^\n]+)/gi, type: 'date' as AIDetectedFieldType, label: 'Date' },
    // Address fields
    { regex: /(?:address|street)[:\s]*([^\n]+)/gi, type: 'text' as AIDetectedFieldType, label: 'Address' },
    // Signature areas
    { regex: /(?:signature|signed|sign\s+here)[:\s]*/gi, type: 'signature' as AIDetectedFieldType, label: 'Signature' },
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(documentText)) !== null) {
      fields.push({
        id: `fallback_field_${fieldIndex++}`,
        label: pattern.label,
        type: pattern.type,
        position: {
          pageNumber: 1,
          x: 10,
          y: 10 + (fieldIndex * 5),
          width: 80,
          height: 5,
        },
        confidence: 0.5, // Lower confidence for fallback
        required: pattern.type === 'signature',
        context: match[0],
      });
    }
  }

  // Detect checkbox-like patterns
  const checkboxPattern = /(?:^|\n)\s*[☐□○◯]\s*([^\n]+)/gm;
  let checkboxMatch;
  while ((checkboxMatch = checkboxPattern.exec(documentText)) !== null) {
    fields.push({
      id: `fallback_checkbox_${fieldIndex++}`,
      label: checkboxMatch[1].trim(),
      type: 'checkbox',
      position: {
        pageNumber: 1,
        x: 10,
        y: 10 + (fieldIndex * 5),
        width: 5,
        height: 3,
      },
      confidence: 0.4,
      required: false,
      context: checkboxMatch[0],
    });
  }

  return {
    fields,
    existingFields: [],
    signatureAreas: fields
      .filter(f => f.type === 'signature')
      .map(f => ({
        pageNumber: f.position.pageNumber,
        x: f.position.x,
        y: f.position.y,
        width: f.position.width,
        height: f.position.height,
        label: f.label,
      })),
    tables: [],
    dateFields: fields.filter(f => f.type === 'date'),
    checkboxGroups: [],
    overallConfidence: 0.4,
  };
}

/**
 * Fallback structure detection using heuristics
 */
export function fallbackStructureDetection(documentText: string): DocumentStructureAnalysis {
  const lines = documentText.split('\n');
  const sections: DocumentStructureAnalysis['sections'] = [];
  
  // Detect headers (usually ALL CAPS or numbered)
  let currentSection = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 0 &&
      trimmed.length < 100 &&
      (
        /^[A-Z][A-Z\s]+$/.test(trimmed) || // ALL CAPS
        /^\d+\.\s+[A-Z]/.test(trimmed) || // Numbered
        /^(SECTION|PART|CHAPTER)\s+/i.test(trimmed) // Section headers
      )
    ) {
      sections.push({
        title: trimmed,
        pageNumber: 1,
        startY: currentSection * 20,
        fieldCount: 0,
      });
      currentSection++;
    }
  }

  // Detect document type from keywords
  let documentType: DocumentType = 'other';
  const lowerText = documentText.toLowerCase();
  
  if (lowerText.includes('application') || lowerText.includes('apply')) {
    documentType = 'application';
  } else if (lowerText.includes('contract') || lowerText.includes('agreement')) {
    documentType = 'contract';
  } else if (lowerText.includes('policy') || lowerText.includes('procedure')) {
    documentType = 'policy';
  } else if (lowerText.includes('form') || lowerText.includes('please complete')) {
    documentType = 'form';
  } else if (lowerText.includes('declare') || lowerText.includes('declaration')) {
    documentType = 'declaration';
  }

  // Detect compliance indicators
  const complianceIndicators: string[] = [];
  const compliancePatterns = [
    /i\s+(?:hereby\s+)?agree/i,
    /i\s+(?:hereby\s+)?declare/i,
    /signature\s+required/i,
    /legal\s+binding/i,
    /terms\s+and\s+conditions/i,
    /privacy\s+policy/i,
    /under\s+penalty\s+of\s+perjury/i,
  ];

  for (const pattern of compliancePatterns) {
    if (pattern.test(documentText)) {
      complianceIndicators.push(pattern.source);
    }
  }

  return {
    documentType,
    title: lines.find(l => l.trim().length > 0 && l.trim().length < 100)?.trim(),
    purpose: undefined,
    sections,
    complianceIndicators,
    hasFillableFields: documentText.includes('___') || documentText.includes('...'),
    requiresSignature: /signature|signed|sign\s+here/i.test(documentText),
    confidence: 0.3,
  };
}

/**
 * Map AI detected field type to form schema field type
 */
export function mapAITypeToFieldType(aiType: AIDetectedFieldType): FieldType {
  const typeMap: Record<AIDetectedFieldType, FieldType> = {
    text: 'text',
    textarea: 'textarea',
    number: 'number',
    email: 'email',
    phone: 'phone',
    date: 'date',
    time: 'time',
    checkbox: 'checkbox',
    signature: 'signature',
    select: 'select',
    radio: 'radio',
    table: 'text', // Tables are complex, default to text
    unknown: 'text',
  };

  return typeMap[aiType] || 'text';
}

/**
 * Convert AI detected field to form field
 */
export function convertAIDetectedFieldToFormField(aiField: AIDetectedField): FormField {
  const fieldType = mapAITypeToFieldType(aiField.type);
  
  const field: FormField = {
    id: aiField.id,
    type: fieldType,
    label: aiField.label,
    placeholder: aiField.placeholder,
    required: aiField.required,
    validation: aiField.validation?.map(v => ({
      type: v.type as any,
      message: v.message || `Invalid ${aiField.label}`,
    })) || [],
    appearance: {
      width: 'full',
      labelPosition: 'top',
      placeholder: aiField.placeholder,
    },
  };

  // Add options for select/radio fields
  if (aiField.options && (fieldType === 'select' || fieldType === 'radio' || fieldType === 'multiselect')) {
    field.options = aiField.options.map(opt => ({
      value: opt.toLowerCase().replace(/\s+/g, '_'),
      label: opt,
    }));
  }

  // Add default value
  if (aiField.defaultValue) {
    field.defaultValue = aiField.defaultValue;
  }

  return field;
}