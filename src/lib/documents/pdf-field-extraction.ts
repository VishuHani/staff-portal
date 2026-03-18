/**
 * PDF Field Extraction Service
 * 
 * This module provides functionality to extract form fields from fillable PDFs
 * using pdf-lib. It identifies field types, positions, and values.
 */

import {
  PDFDocument,
  PDFForm,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFButton,
  PDFField,
} from 'pdf-lib';
import {
  ExtractedPDFField,
  PDFFormFieldType,
  PDFDocumentInfo,
  PDFFieldOption,
} from './pdf-types';

// ============================================================================
// PDF DOCUMENT INFO EXTRACTION
// ============================================================================

/**
 * Extract document information from a PDF
 */
export async function getPDFDocumentInfo(pdfData: ArrayBuffer | Uint8Array): Promise<PDFDocumentInfo> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  
  // Get document metadata
  const title = pdfDoc.getTitle();
  const author = pdfDoc.getAuthor();
  const subject = pdfDoc.getSubject();
  const keywords = pdfDoc.getKeywords();
  const creator = pdfDoc.getCreator();
  const producer = pdfDoc.getProducer();
  const creationDate = pdfDoc.getCreationDate();
  const modificationDate = pdfDoc.getModificationDate();
  
  // Get form fields
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const hasFormFields = fields.length > 0;
  
  // Get page info
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;
  const firstPage = pages[0];
  const pageDimensions = firstPage ? {
    width: firstPage.getWidth(),
    height: firstPage.getHeight(),
  } : undefined;
  
  return {
    pageCount,
    title: title || undefined,
    author: author || undefined,
    subject: subject || undefined,
    keywords: keywords || undefined,
    creator: creator || undefined,
    producer: producer || undefined,
    creationDate: creationDate || undefined,
    modificationDate: modificationDate || undefined,
    hasFormFields,
    isEncrypted: false, // pdf-lib doesn't directly expose this
    isLinearized: false, // pdf-lib doesn't directly expose this
    pdfVersion: undefined, // pdf-lib doesn't directly expose this
    pageDimensions,
  };
}

// ============================================================================
// FORM FIELD EXTRACTION
// ============================================================================

/**
 * Extract all form fields from a PDF
 */
export async function extractPDFFormFields(pdfData: ArrayBuffer | Uint8Array): Promise<ExtractedPDFField[]> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  const extractedFields: ExtractedPDFField[] = [];
  
  for (const field of fields) {
    try {
      const extractedField = extractField(pdfDoc, field);
      if (extractedField) {
        extractedFields.push(extractedField);
      }
    } catch (error) {
      console.warn(`Failed to extract field: ${field.getName()}`, error);
    }
  }
  
  return extractedFields;
}

/**
 * Extract a single field's information
 */
function extractField(pdfDoc: PDFDocument, field: PDFField): ExtractedPDFField | null {
  const fieldName = field.getName();
  const fieldType = field.constructor.name;
  
  // Determine field type and extract info based on type
  if (field instanceof PDFTextField || fieldType === 'PDFTextField') {
    return extractTextField(field as PDFTextField, pdfDoc);
  } else if (field instanceof PDFCheckBox || fieldType === 'PDFCheckBox') {
    return extractCheckboxField(field as PDFCheckBox, pdfDoc);
  } else if (field instanceof PDFDropdown || fieldType === 'PDFDropdown') {
    return extractDropdownField(field as PDFDropdown, pdfDoc);
  } else if (field instanceof PDFRadioGroup || fieldType === 'PDFRadioGroup') {
    return extractRadioField(field as PDFRadioGroup, pdfDoc);
  } else if (field instanceof PDFButton || fieldType === 'PDFButton') {
    return extractButtonField(field as PDFButton, pdfDoc);
  }
  
  // Unknown field type
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: fieldName,
    type: 'unknown',
    readOnly: false,
    required: false,
    pageNumber: 1,
    position: { x: 0, y: 0, width: 0, height: 0 },
    isFillable: false,
  };
}

/**
 * Extract text field information
 */
function extractTextField(field: PDFTextField, pdfDoc: PDFDocument): ExtractedPDFField {
  const name = field.getName();
  let value: string | undefined;
  let maxLength: number | undefined;
  let isMultiline = false;
  let isReadOnly = false;
  let isRequired = false;
  
  try { value = field.getText() || undefined; } catch { /* ignore */ }
  try { maxLength = field.getMaxLength(); } catch { /* ignore */ }
  try { isMultiline = field.isMultiline(); } catch { /* ignore */ }
  try { isReadOnly = field.isReadOnly(); } catch { /* ignore */ }
  try { isRequired = field.isRequired(); } catch { /* ignore */ }
  
  // Get widget position
  const position = getFieldPosition(field, pdfDoc);
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'text',
    value,
    readOnly: isReadOnly,
    required: isRequired,
    pageNumber: position.pageNumber,
    position: position.rect,
    maxLength,
    multiLine: isMultiline,
    isFillable: !isReadOnly,
  };
}

/**
 * Extract checkbox field information
 */
function extractCheckboxField(field: PDFCheckBox, pdfDoc: PDFDocument): ExtractedPDFField {
  const name = field.getName();
  let isChecked = false;
  let isReadOnly = false;
  let isRequired = false;
  
  try { isChecked = field.isChecked(); } catch { /* ignore */ }
  try { isReadOnly = field.isReadOnly(); } catch { /* ignore */ }
  try { isRequired = field.isRequired(); } catch { /* ignore */ }
  
  // Get widget position
  const position = getFieldPosition(field, pdfDoc);
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'checkbox',
    value: isChecked,
    readOnly: isReadOnly,
    required: isRequired,
    pageNumber: position.pageNumber,
    position: position.rect,
    isFillable: !isReadOnly,
  };
}

/**
 * Extract dropdown field information
 */
function extractDropdownField(field: PDFDropdown, pdfDoc: PDFDocument): ExtractedPDFField {
  const name = field.getName();
  let selected: string[] = [];
  let options: string[] = [];
  let isReadOnly = false;
  let isRequired = false;
  
  try { selected = field.getSelected(); } catch { /* ignore */ }
  try { options = field.getOptions(); } catch { /* ignore */ }
  try { isReadOnly = field.isReadOnly(); } catch { /* ignore */ }
  try { isRequired = field.isRequired(); } catch { /* ignore */ }
  
  // Get widget position
  const position = getFieldPosition(field, pdfDoc);
  
  // Map options
  const fieldOptions: PDFFieldOption[] = options.map((opt) => ({
    value: opt,
    label: opt,
  }));
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'dropdown',
    value: selected.length > 0 ? selected[0] : undefined,
    options: fieldOptions,
    readOnly: isReadOnly,
    required: isRequired,
    pageNumber: position.pageNumber,
    position: position.rect,
    isFillable: !isReadOnly,
  };
}

/**
 * Extract radio group field information
 */
function extractRadioField(field: PDFRadioGroup, pdfDoc: PDFDocument): ExtractedPDFField {
  const name = field.getName();
  let selected: string | undefined;
  let options: string[] = [];
  let isReadOnly = false;
  let isRequired = false;
  
  try { selected = field.getSelected(); } catch { /* ignore */ }
  try { options = field.getOptions(); } catch { /* ignore */ }
  try { isReadOnly = field.isReadOnly(); } catch { /* ignore */ }
  try { isRequired = field.isRequired(); } catch { /* ignore */ }
  
  // Get widget position (use first option's position)
  const position = getFieldPosition(field, pdfDoc);
  
  // Map options
  const fieldOptions: PDFFieldOption[] = options.map((opt) => ({
    value: opt,
    label: opt,
  }));
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'radio',
    value: selected,
    options: fieldOptions,
    readOnly: isReadOnly,
    required: isRequired,
    pageNumber: position.pageNumber,
    position: position.rect,
    isFillable: !isReadOnly,
  };
}

/**
 * Extract button field information
 */
function extractButtonField(field: PDFButton, pdfDoc: PDFDocument): ExtractedPDFField {
  const name = field.getName();
  let isReadOnly = false;
  
  try { isReadOnly = field.isReadOnly(); } catch { /* ignore */ }
  
  // Get widget position
  const position = getFieldPosition(field, pdfDoc);
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'button',
    readOnly: isReadOnly,
    required: false,
    pageNumber: position.pageNumber,
    position: position.rect,
    isFillable: false,
  };
}

/**
 * Get field position on page
 */
function getFieldPosition(
  field: PDFField,
  pdfDoc: PDFDocument
): { pageNumber: number; rect: { x: number; y: number; width: number; height: number } } {
  try {
    // Access widgets through the field's acroField property
    const acroField = (field as unknown as { acroField?: { getWidgets?: () => unknown[] } }).acroField;
    const widgets = acroField?.getWidgets?.() || [];
    
    if (widgets.length === 0) {
      return {
        pageNumber: 1,
        rect: { x: 0, y: 0, width: 0, height: 0 },
      };
    }
    
    // Get the first widget's bounding box
    const widget = widgets[0] as { B?: number[]; P?: unknown };
    const bbox = widget.B || [0, 0, 100, 20];
    
    // Try to determine page number
    const pages = pdfDoc.getPages();
    let pageNumber = 1;
    
    // Check if widget has a page reference
    if (widget.P) {
      for (let i = 0; i < pages.length; i++) {
        if ((pages[i] as unknown as { ref?: unknown }).ref === widget.P) {
          pageNumber = i + 1;
          break;
        }
      }
    }
    
    return {
      pageNumber,
      rect: {
        x: bbox[0] || 0,
        y: bbox[1] || 0,
        width: bbox[2] - bbox[0] || 100,
        height: bbox[3] - bbox[1] || 20,
      },
    };
  } catch {
    return {
      pageNumber: 1,
      rect: { x: 0, y: 0, width: 100, height: 20 },
    };
  }
}

// ============================================================================
// FIELD TYPE DETECTION
// ============================================================================

/**
 * Determine the PDF field type from a field object
 */
export function determinePDFFieldType(field: PDFField): PDFFormFieldType {
  const typeName = field.constructor.name;
  
  if (field instanceof PDFTextField || typeName === 'PDFTextField') return 'text';
  if (field instanceof PDFCheckBox || typeName === 'PDFCheckBox') return 'checkbox';
  if (field instanceof PDFDropdown || typeName === 'PDFDropdown') return 'dropdown';
  if (field instanceof PDFRadioGroup || typeName === 'PDFRadioGroup') return 'radio';
  if (field instanceof PDFButton || typeName === 'PDFButton') return 'button';
  return 'unknown';
}

/**
 * Check if a PDF has fillable form fields
 */
export async function hasFillableFields(pdfData: ArrayBuffer | Uint8Array): Promise<boolean> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  return fields.length > 0;
}

/**
 * Get count of fillable fields by type
 */
export async function getFieldCounts(pdfData: ArrayBuffer | Uint8Array): Promise<Record<PDFFormFieldType, number>> {
  const fields = await extractPDFFormFields(pdfData);
  
  const counts: Record<PDFFormFieldType, number> = {
    text: 0,
    checkbox: 0,
    radio: 0,
    dropdown: 0,
    signature: 0,
    button: 0,
    unknown: 0,
  };
  
  for (const field of fields) {
    counts[field.type]++;
  }
  
  return counts;
}

// ============================================================================
// FIELD VALIDATION
// ============================================================================

/**
 * Validate that a field name is valid for PDF forms
 */
export function isValidPDFFieldName(name: string): boolean {
  // PDF field names should not contain certain characters
  const invalidChars = /[.<>(){}[\]\/%]/;
  return !invalidChars.test(name) && name.length > 0 && name.length <= 255;
}

/**
 * Sanitize a field name for PDF forms
 */
export function sanitizePDFFieldName(name: string): string {
  // Replace invalid characters with underscores
  return name.replace(/[.<>(){}[\]\/%]/g, '_').substring(0, 255);
}
