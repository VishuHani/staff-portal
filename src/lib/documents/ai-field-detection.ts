/**
 * AI Field Detection Service
 * 
 * This service analyzes PDF documents to detect potential input fields using AI.
 * It extracts text from PDFs, sends them to OpenAI for analysis, and returns
 * structured field definitions.
 * 
 * Note: This is a library module, not a server actions file.
 * Server actions that use these functions should be in separate files with 'use server'.
 */

import OpenAI from "openai";
import {
  STRUCTURE_DETECTION_SYSTEM_PROMPT,
  FIELD_DETECTION_SYSTEM_PROMPT,
  generateStructureDetectionPrompt,
  generateFieldDetectionPrompt,
  parseStructureDetectionResponse,
  parseFieldDetectionResponse,
  fallbackStructureDetection,
  fallbackFieldDetection,
  type DocumentStructureAnalysis,
  type FieldDetectionResult,
  type AIDetectedField,
} from "./ai-prompts";
import { getPDFDocumentInfo, extractPDFFormFields, hasFillableFields } from "./pdf-field-extraction";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * AI Configuration for field detection
 */
interface AIFieldDetectionConfig {
  /** Maximum retries for AI calls */
  maxRetries: number;
  /** Timeout for AI calls in milliseconds */
  timeout: number;
  /** Confidence threshold for accepting detected fields */
  confidenceThreshold: number;
  /** Model to use for analysis */
  model: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature for AI responses */
  temperature: number;
}

const DEFAULT_CONFIG: AIFieldDetectionConfig = {
  maxRetries: 3,
  timeout: 60000, // 60 seconds
  confidenceThreshold: 0.6,
  model: "gpt-4o-mini",
  maxTokens: 4096,
  temperature: 0.1,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of analyzing a PDF document
 */
export interface PDFAnalysisResult {
  /** Document structure analysis */
  structure: DocumentStructureAnalysis;
  /** Detected fields */
  fields: FieldDetectionResult;
  /** Existing fillable fields (if any) */
  existingFillableFields: {
    name: string;
    type: string;
    value?: string | boolean | string[];
    pageNumber?: number;
  }[];
  /** Whether the PDF has fillable fields */
  hasFillableFields: boolean;
  /** Page count */
  pageCount: number;
  /** Analysis metadata */
  metadata: {
    analyzedAt: Date;
    model: string;
    processingTime: number;
    fallbackUsed: boolean;
  };
}

/**
 * Options for field detection
 */
export interface FieldDetectionOptions {
  /** Include existing fillable fields in analysis */
  includeExistingFields?: boolean;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum pages to analyze (for large documents) */
  maxPages?: number;
  /** Custom configuration */
  config?: Partial<AIFieldDetectionConfig>;
}

/**
 * Progress callback for field detection
 */
export type FieldDetectionProgressCallback = (
  stage: "extracting" | "analyzing_structure" | "detecting_fields" | "complete" | "error",
  message: string,
  progress: number
) => void;

// ============================================================================
// PDF TEXT EXTRACTION (Server-Side using GPT-4o Vision)
// ============================================================================

/**
 * Extract text content from a PDF for AI analysis
 * Uses GPT-4o Vision to analyze the PDF directly
 */
async function extractPDFTextContentServer(
  pdfData: ArrayBuffer,
  maxPages?: number,
  fileName?: string
): Promise<{
  text: string;
  pageCount: number;
  pageTexts: string[];
}> {
  try {
    // Use GPT-4o Vision for text extraction
    const { extractPDFTextForAI } = await import('./pdf-text-extraction');
    const result = await extractPDFTextForAI(pdfData, fileName);
    
    return {
      text: result.text,
      pageCount: maxPages ? Math.min(result.pageCount, maxPages) : result.pageCount,
      pageTexts: result.pageTexts,
    };
  } catch (error) {
    console.error('[AI Field Detection] Text extraction failed:', error);
    return {
      text: 'Unable to extract text from PDF',
      pageCount: 1,
      pageTexts: ['Unable to extract text from PDF'],
    };
  }
}

// ============================================================================
// AI ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Get OpenAI client instance
 */
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, AI features will use fallback");
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Analyze document structure using AI
 */
async function analyzeDocumentStructure(
  documentText: string,
  pageCount: number,
  hasExistingFields: boolean,
  config: AIFieldDetectionConfig
): Promise<DocumentStructureAnalysis> {
  const openai = getOpenAIClient();

  if (!openai) {
    console.log("[AI Field Detection] Using fallback structure detection");
    return fallbackStructureDetection(documentText);
  }

  const prompt = generateStructureDetectionPrompt(documentText, pageCount, hasExistingFields);

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: STRUCTURE_DETECTION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = parseStructureDetectionResponse(content);
    if (!parsed) {
      throw new Error("Failed to parse structure detection response");
    }

    return parsed;
  } catch (error) {
    console.error("[AI Field Detection] Structure analysis failed:", error);
    return fallbackStructureDetection(documentText);
  }
}

/**
 * Detect fields in document using AI
 */
async function detectFieldsWithAI(
  documentText: string,
  pageCount: number,
  structureInfo: DocumentStructureAnalysis,
  config: AIFieldDetectionConfig
): Promise<FieldDetectionResult> {
  const openai = getOpenAIClient();

  if (!openai) {
    console.log("[AI Field Detection] Using fallback field detection");
    return fallbackFieldDetection(documentText);
  }

  const prompt = generateFieldDetectionPrompt(documentText, pageCount, structureInfo);

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: FIELD_DETECTION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = parseFieldDetectionResponse(content);
    if (!parsed) {
      throw new Error("Failed to parse field detection response");
    }

    return parsed;
  } catch (error) {
    console.error("[AI Field Detection] Field detection failed:", error);
    return fallbackFieldDetection(documentText);
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze a PDF document from ArrayBuffer
 * This is the main entry point for field detection
 */
export async function analyzePDFFromBuffer(
  pdfData: ArrayBuffer,
  options: FieldDetectionOptions = {},
  onProgress?: FieldDetectionProgressCallback
): Promise<PDFAnalysisResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_CONFIG, ...options.config };
  let fallbackUsed = false;

  try {
    // Stage 1: Load PDF document
    onProgress?.("extracting", "Loading PDF document...", 5);
    
    // Load with pdf-lib for field extraction
    const pdfDocInfo = await getPDFDocumentInfo(pdfData);
    const pageCount = options.maxPages 
      ? Math.min(pdfDocInfo.pageCount, options.maxPages) 
      : pdfDocInfo.pageCount;

    // Stage 2: Check for existing fillable fields
    onProgress?.("extracting", "Checking for existing form fields...", 15);
    let existingFillableFields: {
      name: string;
      type: string;
      value?: string | boolean;
      pageNumber?: number;
    }[] = [];
    let pdfHasFillableFields = false;

    try {
      pdfHasFillableFields = pdfDocInfo.hasFormFields || false;
      if (pdfHasFillableFields && options.includeExistingFields !== false) {
        const extractedFields = await extractPDFFormFields(pdfData);
        existingFillableFields = extractedFields.map(f => ({
          name: f.name,
          type: String(f.type),
          value: Array.isArray(f.value) ? f.value.join(', ') : f.value,
          pageNumber: f.pageNumber,
        }));
      }
    } catch (error) {
      console.warn("[AI Field Detection] Could not extract fillable fields:", error);
    }

    // Stage 3: Extract text content using server-side extraction
    onProgress?.("extracting", "Extracting text content...", 25);
    let text = "";
    let pageTexts: string[] = [];
    
    try {
      // Use server-side text extraction (pdf-lib based)
      const textResult = await extractPDFTextContentServer(pdfData, options.maxPages);
      text = textResult.text;
      pageTexts = textResult.pageTexts;
    } catch (error) {
      console.warn("[AI Field Detection] Could not extract text:", error);
      // Fallback: create placeholder text
      text = `Document with ${pageCount} pages. Form fields detected: ${existingFillableFields.length}`;
      pageTexts = [text];
    }

    // Stage 4: Analyze document structure
    onProgress?.("analyzing_structure", "Analyzing document structure...", 40);
    const structure = await analyzeDocumentStructure(
      text,
      pageCount,
      pdfHasFillableFields,
      config
    );

    if (structure.confidence < 0.5) {
      fallbackUsed = true;
    }

    // Stage 5: Detect fields
    onProgress?.("detecting_fields", "Detecting input fields...", 70);
    const fields = await detectFieldsWithAI(text, pageCount, structure, config);

    if (fields.overallConfidence < 0.5) {
      fallbackUsed = true;
    }

    // Filter fields by confidence threshold
    const minConfidence = options.minConfidence ?? config.confidenceThreshold;
    fields.fields = fields.fields.filter(
      f => f.confidence >= minConfidence
    );

    // Stage 6: Complete
    onProgress?.("complete", "Analysis complete", 100);

    return {
      structure,
      fields,
      existingFillableFields,
      hasFillableFields: pdfHasFillableFields,
      pageCount,
      metadata: {
        analyzedAt: new Date(),
        model: config.model,
        processingTime: Date.now() - startTime,
        fallbackUsed,
      },
    };
  } catch (error) {
    onProgress?.("error", `Analysis failed: ${error}`, 0);
    throw error;
  }
}

/**
 * Analyze a PDF document from URL
 */
export async function analyzePDFFromURL(
  pdfUrl: string,
  options: FieldDetectionOptions = {},
  onProgress?: FieldDetectionProgressCallback
): Promise<PDFAnalysisResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_CONFIG, ...options.config };
  let fallbackUsed = false;

  try {
    // Stage 1: Fetch PDF from URL
    onProgress?.("extracting", "Fetching PDF from URL...", 5);
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    const pdfData = await response.arrayBuffer();

    // Stage 2: Load PDF document
    onProgress?.("extracting", "Loading PDF document...", 10);
    
    // Load with pdf-lib for field extraction
    const pdfDocInfo = await getPDFDocumentInfo(pdfData);
    const pageCount = options.maxPages 
      ? Math.min(pdfDocInfo.pageCount, options.maxPages) 
      : pdfDocInfo.pageCount;

    // Stage 3: Check for existing fillable fields
    onProgress?.("extracting", "Checking for existing form fields...", 20);
    let existingFillableFields: {
      name: string;
      type: string;
      value?: string | boolean;
      pageNumber?: number;
    }[] = [];
    let pdfHasFillableFields = false;

    try {
      pdfHasFillableFields = pdfDocInfo.hasFormFields || false;
      if (pdfHasFillableFields && options.includeExistingFields !== false) {
        const extractedFields = await extractPDFFormFields(pdfData);
        existingFillableFields = extractedFields.map(f => ({
          name: f.name,
          type: String(f.type),
          value: Array.isArray(f.value) ? f.value.join(', ') : f.value,
          pageNumber: f.pageNumber,
        }));
      }
    } catch (error) {
      console.warn("[AI Field Detection] Could not extract fillable fields:", error);
    }

    // Stage 4: Extract text content using server-side extraction
    onProgress?.("extracting", "Extracting text content...", 30);
    let text = "";
    let pageTexts: string[] = [];
    
    try {
      // Use server-side text extraction (pdf-lib based)
      const textResult = await extractPDFTextContentServer(pdfData, options.maxPages);
      text = textResult.text;
      pageTexts = textResult.pageTexts;
    } catch (error) {
      console.warn("[AI Field Detection] Could not extract text:", error);
      // Fallback: create placeholder text
      text = `Document with ${pageCount} pages. Form fields detected: ${existingFillableFields.length}`;
      pageTexts = [text];
    }

    // Stage 5: Analyze document structure
    onProgress?.("analyzing_structure", "Analyzing document structure...", 45);
    const structure = await analyzeDocumentStructure(
      text,
      pageCount,
      pdfHasFillableFields,
      config
    );

    if (structure.confidence < 0.5) {
      fallbackUsed = true;
    }

    // Stage 6: Detect fields
    onProgress?.("detecting_fields", "Detecting input fields...", 70);
    const fields = await detectFieldsWithAI(text, pageCount, structure, config);

    if (fields.overallConfidence < 0.5) {
      fallbackUsed = true;
    }

    // Filter fields by confidence threshold
    const minConfidence = options.minConfidence ?? config.confidenceThreshold;
    fields.fields = fields.fields.filter(
      f => f.confidence >= minConfidence
    );

    // Stage 7: Complete
    onProgress?.("complete", "Analysis complete", 100);

    return {
      structure,
      fields,
      existingFillableFields,
      hasFillableFields: pdfHasFillableFields,
      pageCount,
      metadata: {
        analyzedAt: new Date(),
        model: config.model,
        processingTime: Date.now() - startTime,
        fallbackUsed,
      },
    };
  } catch (error) {
    onProgress?.("error", `Analysis failed: ${error}`, 0);
    throw error;
  }
}

/**
 * Analyze a PDF document from base64 data
 */
export async function analyzePDFFromBase64(
  base64Data: string,
  options: FieldDetectionOptions = {},
  onProgress?: FieldDetectionProgressCallback
): Promise<PDFAnalysisResult> {
  // Convert base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return analyzePDFFromBuffer(bytes.buffer, options, onProgress);
}

// ============================================================================
// FIELD REFINEMENT FUNCTIONS
// ============================================================================

/**
 * Refine detected fields by merging with existing fillable fields
 */
export function refineDetectedFields(
  detectedFields: AIDetectedField[],
  existingFields: { name: string; type: string; value?: string | boolean; pageNumber?: number }[]
): AIDetectedField[] {
  const refined: AIDetectedField[] = [];
  const usedExistingNames = new Set<string>();

  // First, add all detected fields
  for (const field of detectedFields) {
    refined.push(field);
  }

  // Then, add existing fields that weren't detected
  for (const existing of existingFields) {
    const normalizedExistingName = existing.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // Check if this field was already detected
    const wasDetected = detectedFields.some(df => {
      const normalizedDetectedLabel = df.label.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalizedDetectedLabel.includes(normalizedExistingName) ||
             normalizedExistingName.includes(normalizedDetectedLabel);
    });

    if (!wasDetected) {
      // Add as a new field with high confidence (it exists in the PDF)
      refined.push({
        id: `existing_${existing.name}`,
        label: existing.name.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
        type: mapPDFTypeToAIType(existing.type),
        position: {
          pageNumber: existing.pageNumber || 1,
          x: 0,
          y: 0,
          width: 50,
          height: 5,
        },
        confidence: 0.9, // High confidence - it exists
        required: false,
        defaultValue: typeof existing.value === 'string' ? existing.value : undefined,
      });
    }
  }

  return refined;
}

/**
 * Map PDF field type to AI detected field type
 */
function mapPDFTypeToAIType(pdfType: string): AIDetectedField["type"] {
  const typeMap: Record<string, AIDetectedField["type"]> = {
    "text": "text",
    "Tx": "text",
    "checkbox": "checkbox",
    "Btn": "checkbox",
    "choice": "select",
    "Ch": "select",
    "dropdown": "select",
    "radio": "radio",
    "signature": "signature",
    "Sig": "signature",
    "button": "checkbox",
  };

  return typeMap[pdfType] || "text";
}

// ============================================================================
// FIELD VALIDATION
// ============================================================================

/**
 * Validate detected fields for consistency
 */
export function validateDetectedFields(
  fields: AIDetectedField[]
): {
  valid: AIDetectedField[];
  warnings: string[];
} {
  const valid: AIDetectedField[] = [];
  const warnings: string[] = [];
  const seenLabels = new Map<string, number>();

  for (const field of fields) {
    // Check for duplicate labels
    const normalizedLabel = field.label.toLowerCase().trim();
    if (seenLabels.has(normalizedLabel)) {
      const count = seenLabels.get(normalizedLabel)!;
      warnings.push(`Duplicate field label "${field.label}" (occurrence ${count + 1})`);
      // Rename the field to make it unique
      field.label = `${field.label} (${count + 1})`;
    }
    seenLabels.set(normalizedLabel, (seenLabels.get(normalizedLabel) || 0) + 1);

    // Check for missing required fields
    if (!field.label || field.label.trim() === "") {
      warnings.push(`Field ${field.id} has no label, using default`);
      field.label = `Field ${field.id}`;
    }

    // Check for invalid positions
    if (
      field.position.x < 0 ||
      field.position.y < 0 ||
      field.position.x > 100 ||
      field.position.y > 100
    ) {
      warnings.push(`Field "${field.label}" has invalid position, resetting to default`);
      field.position = {
        pageNumber: field.position.pageNumber,
        x: 10,
        y: 10,
        width: 80,
        height: 5,
      };
    }

    valid.push(field);
  }

  return { valid, warnings };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if AI features are available
 */
export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get field detection statistics
 */
export function getFieldDetectionStats(result: PDFAnalysisResult): {
  totalFields: number;
  highConfidenceFields: number;
  fieldTypes: Record<string, number>;
  averageConfidence: number;
  signatureFields: number;
  requiredFields: number;
} {
  const fields = result.fields.fields;
  const fieldTypes: Record<string, number> = {};
  let totalConfidence = 0;

  for (const field of fields) {
    // Count by type
    fieldTypes[field.type] = (fieldTypes[field.type] || 0) + 1;
    totalConfidence += field.confidence;
  }

  return {
    totalFields: fields.length,
    highConfidenceFields: fields.filter(f => f.confidence >= 0.8).length,
    fieldTypes,
    averageConfidence: fields.length > 0 ? totalConfidence / fields.length : 0,
    signatureFields: fields.filter(f => f.type === "signature").length,
    requiredFields: fields.filter(f => f.required).length,
  };
}

/**
 * Export detected fields to a simple format
 */
export function exportDetectedFields(fields: AIDetectedField[]): {
  label: string;
  type: string;
  required: boolean;
  confidence: number;
}[] {
  return fields.map(f => ({
    label: f.label,
    type: f.type,
    required: f.required,
    confidence: f.confidence,
  }));
}