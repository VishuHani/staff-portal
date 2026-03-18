"use server";

/**
 * AI Change Detection Service
 * 
 * This service compares two versions of a PDF document to detect changes,
 * including added/removed/modified fields, layout changes, and generates
 * impact assessments with recommendations.
 */

import OpenAI from "openai";
import {
  CHANGE_DETECTION_SYSTEM_PROMPT,
  generateChangeDetectionPrompt,
  parseChangeDetectionResponse,
  type AIDetectedField,
  type ChangeDetectionResult,
  type DetectedChange,
  type ChangeType,
  type ImpactLevel,
} from "./ai-prompts";
import { analyzePDFFromBuffer, type PDFAnalysisResult } from "./ai-field-detection";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * AI Configuration for change detection
 */
interface AIChangeDetectionConfig {
  /** Model to use for analysis */
  model: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature for AI responses */
  temperature: number;
  /** Confidence threshold */
  confidenceThreshold: number;
}

const DEFAULT_CONFIG: AIChangeDetectionConfig = {
  model: "gpt-4o-mini",
  maxTokens: 4096,
  temperature: 0.1,
  confidenceThreshold: 0.6,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for change detection
 */
export interface ChangeDetectionOptions {
  /** Custom configuration */
  config?: Partial<AIChangeDetectionConfig>;
  /** Skip AI analysis and use rules only */
  skipAI?: boolean;
  /** Include text content comparison */
  includeTextComparison?: boolean;
}

/**
 * Result of comparing two PDF versions
 */
export interface PDFComparisonResult {
  /** Change detection results */
  changes: ChangeDetectionResult;
  /** Original document analysis */
  originalAnalysis: PDFAnalysisResult;
  /** New document analysis */
  newAnalysis: PDFAnalysisResult;
  /** Comparison metadata */
  metadata: {
    comparedAt: Date;
    model: string;
    processingTime: number;
    aiGenerated: boolean;
  };
}

/**
 * Field mapping suggestion for handling changes
 */
export interface FieldMappingSuggestion {
  /** Original field ID */
  originalFieldId: string;
  /** Suggested new field ID */
  newFieldId: string | null;
  /** Confidence in the mapping */
  confidence: number;
  /** Reason for the suggestion */
  reason: string;
  /** Action to take */
  action: "map" | "remove" | "add" | "manual";
}

/**
 * Change report for display
 */
export interface ChangeReport {
  /** Summary statistics */
  summary: {
    totalChanges: number;
    added: number;
    removed: number;
    modified: number;
    moved: number;
    breaking: number;
    nonBreaking: number;
  };
  /** Changes grouped by impact */
  byImpact: {
    breaking: DetectedChange[];
    nonBreaking: DetectedChange[];
    neutral: DetectedChange[];
  };
  /** Changes grouped by type */
  byType: {
    added: DetectedChange[];
    removed: DetectedChange[];
    modified: DetectedChange[];
    moved: DetectedChange[];
  };
  /** Field mapping suggestions */
  mappingSuggestions: FieldMappingSuggestion[];
  /** Recommendations */
  recommendations: string[];
  /** Whether template update is required */
  requiresUpdate: boolean;
}

// ============================================================================
// AI CHANGE DETECTION
// ============================================================================

/**
 * Get OpenAI client instance
 */
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, change detection will use rules only");
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Detect changes using AI
 */
async function detectChangesWithAI(
  originalText: string,
  newText: string,
  originalFields: AIDetectedField[],
  newFields: AIDetectedField[],
  config: AIChangeDetectionConfig
): Promise<ChangeDetectionResult | null> {
  const openai = getOpenAIClient();

  if (!openai) {
    return null;
  }

  const prompt = generateChangeDetectionPrompt(
    originalText,
    newText,
    originalFields,
    newFields
  );

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: CHANGE_DETECTION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = parseChangeDetectionResponse(content);
    if (!parsed) {
      throw new Error("Failed to parse change detection response");
    }

    return parsed;
  } catch (error) {
    console.error("[AI Change Detection] Detection failed:", error);
    return null;
  }
}

// ============================================================================
// RULES-BASED CHANGE DETECTION (FALLBACK)
// ============================================================================

/**
 * Detect changes using rules (no AI)
 */
function detectChangesWithRules(
  originalFields: AIDetectedField[],
  newFields: AIDetectedField[]
): ChangeDetectionResult {
  const changes: DetectedChange[] = [];
  const originalMap = new Map(originalFields.map(f => [f.id, f]));
  const newMap = new Map(newFields.map(f => [f.id, f]));
  const processedNewIds = new Set<string>();

  // Check for removed and modified fields
  for (const originalField of originalFields) {
    const newField = newMap.get(originalField.id);
    
    if (!newField) {
      // Field was removed
      changes.push({
        id: `change_removed_${originalField.id}`,
        changeType: "removed",
        field: {
          id: originalField.id,
          label: originalField.label,
          type: originalField.type,
        },
        description: `Field "${originalField.label}" was removed`,
        impact: originalField.required ? "breaking" : "non-breaking",
        oldValue: originalField,
        recommendation: originalField.required
          ? "Required field removed. Update form schema and reassign users."
          : "Optional field removed. Consider if data migration is needed.",
      });
    } else {
      // Field exists in both - check for modifications
      processedNewIds.add(newField.id);
      
      const modifications: string[] = [];
      let impact: ImpactLevel = "neutral";
      
      // Check label change
      if (originalField.label !== newField.label) {
        modifications.push(`Label changed from "${originalField.label}" to "${newField.label}"`);
        impact = "non-breaking";
      }
      
      // Check type change
      if (originalField.type !== newField.type) {
        modifications.push(`Type changed from ${originalField.type} to ${newField.type}`);
        impact = "breaking";
      }
      
      // Check required status change
      if (originalField.required !== newField.required) {
        modifications.push(
          newField.required
            ? "Field is now required"
            : "Field is no longer required"
        );
        impact = newField.required ? "breaking" : "non-breaking";
      }
      
      // Check position change
      const positionChanged =
        originalField.position.x !== newField.position.x ||
        originalField.position.y !== newField.position.y;
      
      if (positionChanged) {
        modifications.push("Position changed");
        if (impact === "neutral") {
          impact = "non-breaking";
        }
      }
      
      if (modifications.length > 0) {
        changes.push({
          id: `change_modified_${originalField.id}`,
          changeType: "modified",
          field: {
            id: originalField.id,
            label: newField.label,
            type: newField.type,
          },
          description: modifications.join("; "),
          impact,
          oldValue: originalField,
          newValue: newField,
          position: newField.position,
          recommendation: impact === "breaking"
            ? "Breaking change detected. Review and update form schema."
            : "Non-breaking change. Update field configuration as needed.",
        });
      }
    }
  }

  // Check for added fields
  for (const newField of newFields) {
    if (!processedNewIds.has(newField.id)) {
      changes.push({
        id: `change_added_${newField.id}`,
        changeType: "added",
        field: {
          id: newField.id,
          label: newField.label,
          type: newField.type,
        },
        description: `Field "${newField.label}" was added`,
        impact: newField.required ? "breaking" : "non-breaking",
        newValue: newField,
        position: newField.position,
        recommendation: newField.required
          ? "New required field added. Update form schema and notify users."
          : "New optional field added. Update form schema.",
      });
    }
  }

  // Calculate summary
  const summary = {
    added: changes.filter(c => c.changeType === "added").length,
    removed: changes.filter(c => c.changeType === "removed").length,
    modified: changes.filter(c => c.changeType === "modified").length,
    moved: changes.filter(c => c.changeType === "moved").length,
    breaking: changes.filter(c => c.impact === "breaking").length,
  };

  return {
    changes,
    summary,
    requiresUpdate: summary.breaking > 0 || summary.added > 0 || summary.removed > 0,
    confidence: 0.6,
  };
}

// ============================================================================
// MAIN COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare two PDF documents
 */
export async function comparePDFDocuments(
  originalPdfData: ArrayBuffer,
  newPdfData: ArrayBuffer,
  options: ChangeDetectionOptions = {}
): Promise<PDFComparisonResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_CONFIG, ...options.config };

  // Analyze both documents
  const [originalAnalysis, newAnalysis] = await Promise.all([
    analyzePDFFromBuffer(originalPdfData),
    analyzePDFFromBuffer(newPdfData),
  ]);

  // Detect changes
  let changes: ChangeDetectionResult | null = null;
  let aiGenerated = false;

  if (!options.skipAI) {
    // Extract text for AI comparison
    changes = await detectChangesWithAI(
      originalAnalysis.fields.fields.map(f => f.context || f.label).join("\n"),
      newAnalysis.fields.fields.map(f => f.context || f.label).join("\n"),
      originalAnalysis.fields.fields,
      newAnalysis.fields.fields,
      config
    );

    if (changes) {
      aiGenerated = true;
    }
  }

  // Fall back to rules-based detection
  if (!changes) {
    changes = detectChangesWithRules(
      originalAnalysis.fields.fields,
      newAnalysis.fields.fields
    );
  }

  return {
    changes,
    originalAnalysis,
    newAnalysis,
    metadata: {
      comparedAt: new Date(),
      model: aiGenerated ? config.model : "rules",
      processingTime: Date.now() - startTime,
      aiGenerated,
    },
  };
}

/**
 * Compare PDFs from URLs
 */
export async function comparePDFsFromURL(
  originalUrl: string,
  newUrl: string,
  options: ChangeDetectionOptions = {}
): Promise<PDFComparisonResult> {
  // Fetch both PDFs
  const [originalResponse, newResponse] = await Promise.all([
    fetch(originalUrl),
    fetch(newUrl),
  ]);

  if (!originalResponse.ok) {
    throw new Error(`Failed to fetch original PDF: ${originalResponse.statusText}`);
  }
  if (!newResponse.ok) {
    throw new Error(`Failed to fetch new PDF: ${newResponse.statusText}`);
  }

  const [originalData, newData] = await Promise.all([
    originalResponse.arrayBuffer(),
    newResponse.arrayBuffer(),
  ]);

  return comparePDFDocuments(originalData, newData, options);
}

// ============================================================================
// CHANGE REPORT GENERATION
// ============================================================================

/**
 * Generate a comprehensive change report
 */
export function generateChangeReport(
  result: PDFComparisonResult
): ChangeReport {
  const { changes } = result;

  // Group by impact
  const byImpact = {
    breaking: changes.changes.filter(c => c.impact === "breaking"),
    nonBreaking: changes.changes.filter(c => c.impact === "non-breaking"),
    neutral: changes.changes.filter(c => c.impact === "neutral"),
  };

  // Group by type
  const byType = {
    added: changes.changes.filter(c => c.changeType === "added"),
    removed: changes.changes.filter(c => c.changeType === "removed"),
    modified: changes.changes.filter(c => c.changeType === "modified"),
    moved: changes.changes.filter(c => c.changeType === "moved"),
  };

  // Generate mapping suggestions
  const mappingSuggestions = generateMappingSuggestions(result);

  // Generate recommendations
  const recommendations = generateRecommendations(changes);

  return {
    summary: {
      totalChanges: changes.changes.length,
      ...changes.summary,
      nonBreaking: byImpact.nonBreaking.length,
    },
    byImpact,
    byType,
    mappingSuggestions,
    recommendations,
    requiresUpdate: changes.requiresUpdate,
  };
}

/**
 * Generate field mapping suggestions
 */
function generateMappingSuggestions(
  result: PDFComparisonResult
): FieldMappingSuggestion[] {
  const suggestions: FieldMappingSuggestion[] = [];
  const { originalAnalysis, newAnalysis, changes } = result;

  // Get removed and added fields
  const removedFields = changes.changes
    .filter(c => c.changeType === "removed")
    .map(c => c.field!);
  const addedFields = changes.changes
    .filter(c => c.changeType === "added")
    .map(c => c.field!);

  // Try to match removed fields to added fields
  for (const removedField of removedFields) {
    let bestMatch: { field: typeof addedFields[0]; score: number } | null = null;

    for (const addedField of addedFields) {
      const score = calculateFieldSimilarity(removedField, addedField);
      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { field: addedField, score };
      }
    }

    if (bestMatch) {
      suggestions.push({
        originalFieldId: removedField.id,
        newFieldId: bestMatch.field.id,
        confidence: bestMatch.score,
        reason: `Similar label and type (${removedField.type} → ${bestMatch.field.type})`,
        action: "map",
      });
    } else {
      suggestions.push({
        originalFieldId: removedField.id,
        newFieldId: null,
        confidence: 0.9,
        reason: "No matching field found in new version",
        action: "remove",
      });
    }
  }

  // Add suggestions for new fields that weren't matched
  const mappedNewIds = new Set(
    suggestions.filter(s => s.newFieldId).map(s => s.newFieldId)
  );
  
  for (const addedField of addedFields) {
    if (!mappedNewIds.has(addedField.id)) {
      suggestions.push({
        originalFieldId: "",
        newFieldId: addedField.id,
        confidence: 0.9,
        reason: "New field with no corresponding field in original",
        action: "add",
      });
    }
  }

  return suggestions;
}

/**
 * Calculate similarity between two fields
 */
function calculateFieldSimilarity(
  field1: { label: string; type: string },
  field2: { label: string; type: string }
): number {
  let score = 0;

  // Label similarity (case-insensitive)
  const label1 = field1.label.toLowerCase();
  const label2 = field2.label.toLowerCase();
  
  if (label1 === label2) {
    score += 0.6;
  } else if (label1.includes(label2) || label2.includes(label1)) {
    score += 0.4;
  } else {
    // Check for word overlap
    const words1 = new Set(label1.split(/\s+/));
    const words2 = new Set(label2.split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    score += (intersection.size / union.size) * 0.3;
  }

  // Type match
  if (field1.type === field2.type) {
    score += 0.4;
  }

  return score;
}

/**
 * Generate recommendations based on changes
 */
function generateRecommendations(changes: ChangeDetectionResult): string[] {
  const recommendations: string[] = [];

  // Breaking changes
  if (changes.summary.breaking > 0) {
    recommendations.push(
      `⚠️ ${changes.summary.breaking} breaking change(s) detected. Review and update form schema before deploying.`
    );
  }

  // Removed required fields
  const removedRequired = changes.changes.filter(
    c => c.changeType === "removed" && c.impact === "breaking"
  );
  if (removedRequired.length > 0) {
    recommendations.push(
      "Required fields were removed. Consider data migration for existing submissions."
    );
  }

  // New required fields
  const addedRequired = changes.changes.filter(
    c => c.changeType === "added" && c.field?.type && c.impact === "breaking"
  );
  if (addedRequired.length > 0) {
    recommendations.push(
      "New required fields were added. Existing submissions may need to be updated."
    );
  }

  // Type changes
  const typeChanges = changes.changes.filter(
    c => c.changeType === "modified" && c.description?.includes("Type changed")
  );
  if (typeChanges.length > 0) {
    recommendations.push(
      "Field type changes detected. Verify data compatibility with existing submissions."
    );
  }

  // General recommendations
  if (changes.requiresUpdate) {
    recommendations.push(
      "Template update required. Create a new version and notify assigned users."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("No significant changes detected. No action required.");
  }

  return recommendations;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if change detection is available
 */
export function isChangeDetectionAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Export changes to a simple format
 */
export function exportChanges(changes: DetectedChange[]): {
  type: string;
  field: string;
  description: string;
  impact: string;
  recommendation: string;
}[] {
  return changes.map(c => ({
    type: c.changeType,
    field: c.field?.label || "Unknown",
    description: c.description,
    impact: c.impact,
    recommendation: c.recommendation,
  }));
}

/**
 * Check if changes require user notification
 */
export function changesRequireNotification(changes: ChangeDetectionResult): boolean {
  return (
    changes.summary.breaking > 0 ||
    changes.summary.removed > 0 ||
    changes.changes.some(c => 
      c.changeType === "modified" && 
      c.description?.includes("required")
    )
  );
}

/**
 * Get change severity level
 */
export function getChangeSeverity(changes: ChangeDetectionResult): 
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical" {
  if (changes.changes.length === 0) return "none";
  
  const breakingCount = changes.summary.breaking;
  const removedCount = changes.summary.removed;
  
  if (breakingCount > 5 || removedCount > 3) return "critical";
  if (breakingCount > 2 || removedCount > 1) return "high";
  if (breakingCount > 0 || changes.summary.modified > 3) return "medium";
  if (changes.changes.length > 0) return "low";
  
  return "none";
}