/**
 * Overlay Fields Service
 * 
 * This module provides functionality for creating and managing overlay fields
 * on static PDFs. Overlay fields allow interactive elements to be placed on
 * non-fillable PDFs using percentage-based positioning for responsiveness.
 */

import type { FieldType, FormField, FieldValidation, SelectOption } from "@/lib/types/form-schema";
import type { AIDetectedField } from "./ai-prompts";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Overlay field definition for static PDFs
 */
export interface PDFFOverlayField {
  /** Unique identifier */
  id: string;
  /** Field type */
  fieldType: FieldType;
  /** Field label */
  label: string;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Position as percentages (0-100) for responsiveness */
  position: {
    x: number;      // Left position (0-100%)
    y: number;      // Top position (0-100%)
    width: number;  // Width (0-100%)
    height: number; // Height (0-100%)
  };
  /** Whether the field is required */
  required: boolean;
  /** Validation rules */
  validation?: FieldValidation[];
  /** Options for select/radio fields */
  options?: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: string | boolean | number;
  /** Help text */
  helpText?: string;
  /** Tab index for navigation */
  tabIndex?: number;
  /** Whether field is read-only */
  readOnly?: boolean;
  /** Custom CSS class */
  className?: string;
}

/**
 * Overlay configuration for a PDF document
 */
export interface PDFOverlayConfig {
  /** Document ID */
  documentId: string;
  /** Document version */
  version: number;
  /** Total pages */
  totalPages: number;
  /** All overlay fields */
  fields: PDFFOverlayField[];
  /** Page dimensions for reference (in points) */
  pageDimensions?: {
    width: number;
    height: number;
  }[];
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Created by user ID */
  createdBy: string;
}

/**
 * Options for creating overlay fields
 */
export interface CreateOverlayOptions {
  /** Document ID */
  documentId: string;
  /** Page dimensions in points */
  pageDimensions: { width: number; height: number }[];
  /** User ID creating the overlay */
  userId: string;
}

/**
 * Result of creating overlay fields from detected fields
 */
export interface CreateOverlayResult {
  /** Overlay configuration */
  config: PDFOverlayConfig;
  /** Number of fields created */
  fieldCount: number;
  /** Any warnings during creation */
  warnings: string[];
}

/**
 * Field position in absolute coordinates (for rendering)
 */
export interface AbsoluteFieldPosition {
  /** Field ID */
  fieldId: string;
  /** Page number */
  pageNumber: number;
  /** Absolute position in pixels */
  absolute: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Container dimensions used for calculation */
  containerDimensions: {
    width: number;
    height: number;
  };
}

// ============================================================================
// OVERLAY FIELD CREATION
// ============================================================================

/**
 * Create overlay fields from AI-detected fields
 */
export function createOverlayFromDetectedFields(
  detectedFields: AIDetectedField[],
  options: CreateOverlayOptions
): CreateOverlayResult {
  const warnings: string[] = [];
  const fields: PDFFOverlayField[] = [];
  let tabIndex = 1;

  for (const detected of detectedFields) {
    // Skip non-input fields
    if (detected.type === "unknown") {
      warnings.push(`Skipped unknown field type for "${detected.label}"`);
      continue;
    }

    // Map AI detected type to form field type
    const fieldType = mapAITypeToFieldType(detected.type);
    
    // Create overlay field
    const overlayField: PDFFOverlayField = {
      id: detected.id,
      fieldType,
      label: detected.label,
      pageNumber: detected.position.pageNumber,
      position: {
        x: detected.position.x,
        y: detected.position.y,
        width: detected.position.width,
        height: detected.position.height,
      },
      required: detected.required,
      tabIndex: tabIndex++,
      placeholder: detected.placeholder,
      defaultValue: detected.defaultValue,
    };

    // Add validation rules
    if (detected.validation && detected.validation.length > 0) {
      overlayField.validation = detected.validation.map(v => ({
        type: v.type as FieldValidation["type"],
        message: v.message || `Invalid value for ${detected.label}`,
      }));
    }

    // Add options for select/radio fields
    if (detected.options && (fieldType === "select" || fieldType === "radio")) {
      overlayField.options = detected.options.map(opt => ({
        value: opt.toLowerCase().replace(/\s+/g, "_"),
        label: opt,
      }));
    }

    // Validate position
    if (!isValidPosition(overlayField.position)) {
      warnings.push(
        `Field "${detected.label}" has invalid position, using defaults`
      );
      overlayField.position = getDefaultPosition(detected.position.pageNumber);
    }

    fields.push(overlayField);
  }

  // Create configuration
  const config: PDFOverlayConfig = {
    documentId: options.documentId,
    version: 1,
    totalPages: options.pageDimensions.length,
    fields,
    pageDimensions: options.pageDimensions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: options.userId,
  };

  return {
    config,
    fieldCount: fields.length,
    warnings,
  };
}

/**
 * Create a single overlay field
 */
export function createOverlayField(
  params: {
    id?: string;
    fieldType: FieldType;
    label: string;
    pageNumber: number;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    required?: boolean;
    options?: SelectOption[];
    placeholder?: string;
    defaultValue?: string | boolean | number;
    helpText?: string;
  }
): PDFFOverlayField {
  return {
    id: params.id || `overlay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fieldType: params.fieldType,
    label: params.label,
    pageNumber: params.pageNumber,
    position: params.position,
    required: params.required ?? false,
    options: params.options,
    placeholder: params.placeholder,
    defaultValue: params.defaultValue,
    helpText: params.helpText,
    tabIndex: 0, // Will be assigned later
  };
}

// ============================================================================
// POSITION CALCULATIONS
// ============================================================================

/**
 * Calculate absolute position from percentage position
 */
export function calculateAbsolutePosition(
  field: PDFFOverlayField,
  containerWidth: number,
  containerHeight: number
): AbsoluteFieldPosition {
  return {
    fieldId: field.id,
    pageNumber: field.pageNumber,
    absolute: {
      x: (field.position.x / 100) * containerWidth,
      y: (field.position.y / 100) * containerHeight,
      width: (field.position.width / 100) * containerWidth,
      height: (field.position.height / 100) * containerHeight,
    },
    containerDimensions: {
      width: containerWidth,
      height: containerHeight,
    },
  };
}

/**
 * Calculate percentage position from absolute coordinates
 */
export function calculatePercentagePosition(
  absoluteX: number,
  absoluteY: number,
  absoluteWidth: number,
  absoluteHeight: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (absoluteX / containerWidth) * 100,
    y: (absoluteY / containerHeight) * 100,
    width: (absoluteWidth / containerWidth) * 100,
    height: (absoluteHeight / containerHeight) * 100,
  };
}

/**
 * Convert point-based position to percentage
 */
export function pointsToPercentage(
  points: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (points.x / pageWidth) * 100,
    y: (points.y / pageHeight) * 100,
    width: (points.width / pageWidth) * 100,
    height: (points.height / pageHeight) * 100,
  };
}

/**
 * Convert percentage position to points
 */
export function percentageToPoints(
  percentage: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (percentage.x / 100) * pageWidth,
    y: (percentage.y / 100) * pageHeight,
    width: (percentage.width / 100) * pageWidth,
    height: (percentage.height / 100) * pageHeight,
  };
}

// ============================================================================
// FIELD MANAGEMENT
// ============================================================================

/**
 * Update an overlay field
 */
export function updateOverlayField(
  config: PDFOverlayConfig,
  fieldId: string,
  updates: Partial<PDFFOverlayField>
): PDFOverlayConfig {
  const fieldIndex = config.fields.findIndex(f => f.id === fieldId);
  
  if (fieldIndex === -1) {
    throw new Error(`Field ${fieldId} not found`);
  }

  const updatedFields = [...config.fields];
  updatedFields[fieldIndex] = {
    ...updatedFields[fieldIndex],
    ...updates,
  };

  return {
    ...config,
    fields: updatedFields,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Delete an overlay field
 */
export function deleteOverlayField(
  config: PDFOverlayConfig,
  fieldId: string
): PDFOverlayConfig {
  return {
    ...config,
    fields: config.fields.filter(f => f.id !== fieldId),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Move an overlay field to a new position
 */
export function moveOverlayField(
  config: PDFOverlayConfig,
  fieldId: string,
  newPosition: { x: number; y: number; width: number; height: number }
): PDFOverlayConfig {
  return updateOverlayField(config, fieldId, { position: newPosition });
}

/**
 * Reorder overlay fields (update tab indices)
 */
export function reorderOverlayFields(
  config: PDFOverlayConfig,
  fieldIds: string[]
): PDFOverlayConfig {
  const fieldMap = new Map(config.fields.map(f => [f.id, f]));
  const reorderedFields: PDFFOverlayField[] = [];

  // Add fields in new order
  for (let i = 0; i < fieldIds.length; i++) {
    const field = fieldMap.get(fieldIds[i]);
    if (field) {
      reorderedFields.push({
        ...field,
        tabIndex: i + 1,
      });
      fieldMap.delete(fieldIds[i]);
    }
  }

  // Add remaining fields (not in the reorder list)
  let remainingIndex = reorderedFields.length + 1;
  for (const field of fieldMap.values()) {
    reorderedFields.push({
      ...field,
      tabIndex: remainingIndex++,
    });
  }

  return {
    ...config,
    fields: reorderedFields,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Duplicate an overlay field
 */
export function duplicateOverlayField(
  config: PDFOverlayConfig,
  fieldId: string,
  offsetX: number = 5,
  offsetY: number = 5
): PDFOverlayConfig {
  const field = config.fields.find(f => f.id === fieldId);
  
  if (!field) {
    throw new Error(`Field ${fieldId} not found`);
  }

  const newField: PDFFOverlayField = {
    ...field,
    id: `overlay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    label: `${field.label} (copy)`,
    position: {
      x: Math.min(field.position.x + offsetX, 100 - field.position.width),
      y: Math.min(field.position.y + offsetY, 100 - field.position.height),
      width: field.position.width,
      height: field.position.height,
    },
    tabIndex: config.fields.length + 1,
  };

  return {
    ...config,
    fields: [...config.fields, newField],
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Convert overlay field to form field
 */
export function overlayToFormField(overlay: PDFFOverlayField): FormField {
  return {
    id: overlay.id,
    type: overlay.fieldType,
    label: overlay.label,
    placeholder: overlay.placeholder,
    required: overlay.required,
    validation: overlay.validation,
    defaultValue: overlay.defaultValue,
    options: overlay.options,
    helpText: overlay.helpText,
    appearance: {
      width: "full",
      labelPosition: "hidden", // Labels are shown by overlay
    },
  };
}

/**
 * Convert form field to overlay field
 */
export function formFieldToOverlay(
  field: FormField,
  pageNumber: number,
  position: { x: number; y: number; width: number; height: number }
): PDFFOverlayField {
  return {
    id: field.id,
    fieldType: field.type,
    label: field.label,
    pageNumber,
    position,
    required: field.required,
    validation: field.validation,
    options: field.options,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue as string | boolean | number | undefined,
    helpText: field.helpText,
    tabIndex: 0,
  };
}

/**
 * Convert entire overlay config to form schema fields
 */
export function overlayConfigToFormFields(config: PDFOverlayConfig): FormField[] {
  return config.fields.map(overlayToFormField);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate overlay configuration
 */
export function validateOverlayConfig(
  config: PDFOverlayConfig
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.documentId) {
    errors.push("Document ID is required");
  }
  if (config.totalPages < 1) {
    errors.push("Total pages must be at least 1");
  }

  // Check field IDs are unique
  const fieldIds = new Set<string>();
  for (const field of config.fields) {
    if (fieldIds.has(field.id)) {
      errors.push(`Duplicate field ID: ${field.id}`);
    }
    fieldIds.add(field.id);

    // Validate position
    if (!isValidPosition(field.position)) {
      errors.push(`Field ${field.id} has invalid position`);
    }

    // Validate page number
    if (field.pageNumber < 1 || field.pageNumber > config.totalPages) {
      errors.push(
        `Field ${field.id} has invalid page number ${field.pageNumber}`
      );
    }

    // Check for overlapping fields
    const overlapping = findOverlappingFields(field, config.fields);
    if (overlapping.length > 0) {
      warnings.push(
        `Field ${field.id} overlaps with: ${overlapping.map(f => f.id).join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if position is valid
 */
function isValidPosition(position: { x: number; y: number; width: number; height: number }): boolean {
  return (
    position.x >= 0 &&
    position.x <= 100 &&
    position.y >= 0 &&
    position.y <= 100 &&
    position.width > 0 &&
    position.width <= 100 &&
    position.height > 0 &&
    position.height <= 100 &&
    position.x + position.width <= 100 &&
    position.y + position.height <= 100
  );
}

/**
 * Get default position for a field
 */
function getDefaultPosition(pageNumber: number): { x: number; y: number; width: number; height: number } {
  return {
    x: 10,
    y: 10 + (pageNumber - 1) * 5,
    width: 80,
    height: 5,
  };
}

/**
 * Find fields that overlap with a given field
 */
function findOverlappingFields(
  field: PDFFOverlayField,
  allFields: PDFFOverlayField[]
): PDFFOverlayField[] {
  return allFields.filter(other => {
    if (other.id === field.id || other.pageNumber !== field.pageNumber) {
      return false;
    }

    // Check for overlap
    const f = field.position;
    const o = other.position;

    return !(
      f.x + f.width <= o.x ||
      o.x + o.width <= f.x ||
      f.y + f.height <= o.y ||
      o.y + o.height <= f.y
    );
  });
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Export overlay configuration to JSON
 */
export function exportOverlayConfigToJSON(config: PDFOverlayConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import overlay configuration from JSON
 */
export function importOverlayConfigFromJSON(json: string): PDFOverlayConfig | null {
  try {
    const config = JSON.parse(json) as PDFOverlayConfig;
    const validation = validateOverlayConfig(config);
    
    if (!validation.valid) {
      console.error("Overlay config validation errors:", validation.errors);
      return null;
    }
    
    return config;
  } catch (error) {
    console.error("Failed to parse overlay config JSON:", error);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map AI detected field type to form field type
 */
function mapAITypeToFieldType(aiType: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    text: "text",
    textarea: "textarea",
    number: "number",
    email: "email",
    phone: "phone",
    date: "date",
    time: "time",
    checkbox: "checkbox",
    signature: "signature",
    select: "select",
    radio: "radio",
  };

  return typeMap[aiType] || "text";
}

/**
 * Get fields for a specific page
 */
export function getFieldsForPage(
  config: PDFOverlayConfig,
  pageNumber: number
): PDFFOverlayField[] {
  return config.fields.filter(f => f.pageNumber === pageNumber);
}

/**
 * Get field by ID
 */
export function getFieldById(
  config: PDFOverlayConfig,
  fieldId: string
): PDFFOverlayField | undefined {
  return config.fields.find(f => f.id === fieldId);
}

/**
 * Count fields by type
 */
export function countFieldsByType(config: PDFOverlayConfig): Record<FieldType, number> {
  const counts: Record<FieldType, number> = {
    text: 0,
    textarea: 0,
    number: 0,
    email: 0,
    phone: 0,
    date: 0,
    time: 0,
    datetime: 0,
    select: 0,
    multiselect: 0,
    radio: 0,
    checkbox: 0,
    toggle: 0,
    file: 0,
    image: 0,
    signature: 0,
    divider: 0,
    header: 0,
    paragraph: 0,
    rating: 0,
    scale: 0,
    slider: 0,
    calculation: 0,
    currency: 0,
    percentage: 0,
    url: 0,
    matrix: 0,
    repeating_section: 0,
    page_break: 0,
  };

  for (const field of config.fields) {
    counts[field.fieldType]++;
  }

  return counts;
}