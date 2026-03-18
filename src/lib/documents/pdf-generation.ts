/**
 * PDF Generation Service
 * 
 * This module provides functionality to fill PDF form fields with user submission data,
 * flatten PDFs (make non-editable), add signature images, and generate final PDFs.
 */

import { PDFDocument, PDFImage, rgb, StandardFonts, degrees } from 'pdf-lib';
import {
  PDFFieldValue,
  PDFGenerationOptions,
  PDFGenerationResult,
  PDFFormFieldType,
} from './pdf-types';

// ============================================================================
// PDF FILLING
// ============================================================================

/**
 * Fill PDF form fields with provided values
 */
export async function fillPDFFormFields(
  pdfDoc: PDFDocument,
  fieldValues: PDFFieldValue[]
): Promise<{ filled: number; failed: string[] }> {
  const form = pdfDoc.getForm();
  let filled = 0;
  const failed: string[] = [];
  
  for (const fieldValue of fieldValues) {
    try {
      // Try to get the field
      const field = form.getField(fieldValue.fieldName);
      const fieldType = field.constructor.name;
      
      if (fieldType === 'PDFTextField') {
        const textField = form.getTextField(fieldValue.fieldName);
        textField.setText(String(fieldValue.value));
        filled++;
      } else if (fieldType === 'PDFCheckBox') {
        const checkbox = form.getCheckBox(fieldValue.fieldName);
        const boolValue = fieldValue.value === true || 
                         fieldValue.value === 'true' || 
                         fieldValue.value === 'Yes' ||
                         fieldValue.value === '1';
        if (boolValue) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
        filled++;
      } else if (fieldType === 'PDFDropdown') {
        const dropdown = form.getDropdown(fieldValue.fieldName);
        const value = Array.isArray(fieldValue.value) 
          ? fieldValue.value[0] 
          : String(fieldValue.value);
        dropdown.select(value);
        filled++;
      } else if (fieldType === 'PDFRadioGroup') {
        const radioGroup = form.getRadioGroup(fieldValue.fieldName);
        radioGroup.select(String(fieldValue.value));
        filled++;
      } else {
        failed.push(fieldValue.fieldName);
      }
    } catch (error) {
      failed.push(fieldValue.fieldName);
      console.warn(`Failed to fill field ${fieldValue.fieldName}:`, error);
    }
  }
  
  return { filled, failed };
}

/**
 * Fill a PDF with form data
 */
export async function fillPDFWithData(
  pdfData: ArrayBuffer | Uint8Array,
  formData: Record<string, unknown>,
  fieldTypes?: Record<string, PDFFormFieldType>
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  
  // Convert form data to field values
  const fieldValues: PDFFieldValue[] = Object.entries(formData).map(([fieldName, value]) => ({
    fieldName,
    value: value as string | boolean | string[],
    type: fieldTypes?.[fieldName] || 'text',
  }));
  
  await fillPDFFormFields(pdfDoc, fieldValues);
  
  return pdfDoc;
}

// ============================================================================
// PDF FLATTENING
// ============================================================================

/**
 * Flatten a PDF (make form fields non-editable)
 * This draws the form field appearances directly onto the page content
 */
export async function flattenPDF(pdfDoc: PDFDocument): Promise<void> {
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  for (const field of fields) {
    try {
      // Get field appearance
      const widgets = (field as unknown as { acroField?: { getWidgets?: () => unknown[] } }).acroField?.getWidgets?.() || [];
      
      for (const widget of widgets) {
        // The appearance is already rendered, we just need to ensure it's part of the page content
        // pdf-lib handles this when we don't remove the form
      }
    } catch (error) {
      console.warn('Failed to process field for flattening:', error);
    }
  }
  
  // Remove the form to make fields non-editable
  // Note: This removes interactivity but keeps the visual appearance
  form.flatten();
}

/**
 * Alternative flatten method that creates a new PDF with content burned in
 */
export async function flattenPDFComplete(pdfDoc: PDFDocument): Promise<PDFDocument> {
  // Create a new document
  const newDoc = await PDFDocument.create();
  
  // Copy all pages
  const pages = pdfDoc.getPages();
  const copiedPages = await newDoc.copyPages(pdfDoc, pages.map((_, i) => i));
  
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }
  
  // The new document won't have form fields, just the visual content
  return newDoc;
}

// ============================================================================
// SIGNATURE HANDLING
// ============================================================================

/**
 * Embed a signature image into a PDF
 */
export async function embedSignatureImage(
  pdfDoc: PDFDocument,
  signatureImage: string | ArrayBuffer | Uint8Array,
  options?: {
    pageNumber?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fieldName?: string;
  }
): Promise<PDFImage> {
  let image: PDFImage;
  
  // Handle different input types
  if (typeof signatureImage === 'string') {
    // Assume base64 or data URL
    let imageData: Uint8Array;
    
    if (signatureImage.startsWith('data:')) {
      // Data URL - extract base64 part
      const base64 = signatureImage.split(',')[1];
      imageData = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } else {
      // Plain base64
      imageData = Uint8Array.from(atob(signatureImage), (c) => c.charCodeAt(0));
    }
    
    // Detect image type and embed
    if (signatureImage.includes('png') || signatureImage.startsWith('iVBOR')) {
      image = await pdfDoc.embedPng(imageData);
    } else {
      image = await pdfDoc.embedJpg(imageData);
    }
  } else {
    // ArrayBuffer or Uint8Array - try PNG first, then JPG
    try {
      image = await pdfDoc.embedPng(signatureImage);
    } catch {
      image = await pdfDoc.embedJpg(signatureImage);
    }
  }
  
  // If field name is provided, try to place signature in that field
  if (options?.fieldName) {
    try {
      const form = pdfDoc.getForm();
      const field = form.getField(options.fieldName);
      
      // Get field position (if it's a signature field)
      // For now, we'll draw on the page at specified coordinates
    } catch {
      // Field not found, use coordinates
    }
  }
  
  // Draw on page if coordinates provided
  if (options?.pageNumber && options?.x !== undefined && options?.y !== undefined) {
    const pages = pdfDoc.getPages();
    const page = pages[options.pageNumber - 1];
    
    if (page) {
      const width = options.width || image.width;
      const height = options.height || image.height;
      
      page.drawImage(image, {
        x: options.x,
        y: options.y,
        width,
        height,
      });
    }
  }
  
  return image;
}

/**
 * Add signature to a signature field
 */
export async function addSignatureToField(
  pdfDoc: PDFDocument,
  fieldName: string,
  signatureImage: string | ArrayBuffer | Uint8Array
): Promise<boolean> {
  try {
    const form = pdfDoc.getForm();
    const field = form.getField(fieldName);
    
    // Embed the signature image
    const image = await embedSignatureImage(pdfDoc, signatureImage);
    
    // Get the field's widget to determine position
    const widgets = (field as unknown as { acroField?: { getWidgets?: () => unknown[] } }).acroField?.getWidgets?.() || [];
    
    if (widgets.length > 0) {
      const widget = widgets[0] as { P?: unknown; B?: number[] };
      const pages = pdfDoc.getPages();
      
      // Find the page
      let pageIndex = 0;
      for (let i = 0; i < pages.length; i++) {
        if ((pages[i] as unknown as { ref?: unknown }).ref === widget.P) {
          pageIndex = i;
          break;
        }
      }
      
      const page = pages[pageIndex];
      const bbox = widget.B || [0, 0, 150, 50];
      
      // Draw the signature
      page.drawImage(image, {
        x: bbox[0],
        y: bbox[1],
        width: bbox[2] - bbox[0],
        height: bbox[3] - bbox[1],
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('Failed to add signature to field:', error);
    return false;
  }
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generate a filled PDF with all options
 */
export async function generateFilledPDF(
  pdfData: ArrayBuffer | Uint8Array,
  fieldValues: PDFFieldValue[],
  options: PDFGenerationOptions = { flatten: false }
): Promise<PDFGenerationResult> {
  try {
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    
    // Fill form fields
    const { filled, failed } = await fillPDFFormFields(pdfDoc, fieldValues);
    
    // Add signature if provided
    if (options.includeSignature && options.signatureImage) {
      if (options.signatureFieldName) {
        await addSignatureToField(pdfDoc, options.signatureFieldName, options.signatureImage);
      }
    }
    
    // Flatten if requested
    if (options.flatten) {
      await flattenPDF(pdfDoc);
    }
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: !options.compress,
    });
    
    // Create blob
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    
    // Create base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    
    return {
      success: true,
      blob,
      arrayBuffer: pdfBytes.buffer as ArrayBuffer,
      base64,
      fieldsFilled: filled,
      fieldsFailed: failed.length,
      failedFields: failed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
      fieldsFilled: 0,
      fieldsFailed: fieldValues.length,
    };
  }
}

/**
 * Generate a PDF from form submission data
 */
export async function generateSubmissionPDF(
  templatePdfUrl: string,
  formData: Record<string, unknown>,
  signatureUrl?: string,
  options?: Partial<PDFGenerationOptions>
): Promise<PDFGenerationResult> {
  try {
    // Fetch the template PDF
    const response = await fetch(templatePdfUrl);
    const pdfData = await response.arrayBuffer();
    
    // Convert form data to field values
    const fieldValues: PDFFieldValue[] = Object.entries(formData)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([fieldName, value]) => ({
        fieldName,
        value: value as string | boolean | string[],
        type: 'text' as PDFFormFieldType,
      }));
    
    // Generate options
    const genOptions: PDFGenerationOptions = {
      flatten: true,
      includeSignature: !!signatureUrl,
      signatureImage: signatureUrl,
      ...options,
    };
    
    return generateFilledPDF(pdfData, fieldValues, genOptions);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate submission PDF',
      fieldsFilled: 0,
      fieldsFailed: 0,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a blank PDF with a form
 */
export async function createBlankPDF(): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  
  // Add a form
  const form = pdfDoc.getForm();
  
  return pdfDoc;
}

/**
 * Add a text watermark to all pages
 */
export async function addWatermark(
  pdfDoc: PDFDocument,
  text: string,
  options?: {
    fontSize?: number;
    color?: { r: number; g: number; b: number };
    opacity?: number;
    rotation?: number;
  }
): Promise<void> {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const fontSize = options?.fontSize || 50;
  const color = options?.color || { r: 0.8, g: 0.8, b: 0.8 };
  const opacity = options?.opacity || 0.3;
  const rotation = options?.rotation || -45;
  
  for (const page of pages) {
    const { width, height } = page.getSize();
    
    // Calculate text dimensions
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = fontSize;
    
    // Center the watermark
    const x = (width - textWidth) / 2;
    const y = (height - textHeight) / 2;
    
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(rotation),
    });
  }
}

/**
 * Add page numbers to all pages
 */
export async function addPageNumbers(
  pdfDoc: PDFDocument,
  options?: {
    format?: string;
    position?: 'bottom-center' | 'bottom-right' | 'bottom-left';
    fontSize?: number;
    startPage?: number;
  }
): Promise<void> {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = options?.fontSize || 10;
  const startPage = options?.startPage || 1;
  
  for (let i = 0; i < pages.length; i++) {
    const pageIndex = i + 1;
    if (pageIndex < startPage) continue;
    
    const page = pages[i];
    const { width, height } = page.getSize();
    
    const text = options?.format
      ? options.format.replace('{page}', String(pageIndex)).replace('{total}', String(pages.length))
      : `Page ${pageIndex} of ${pages.length}`;
    
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    let x: number;
    switch (options?.position) {
      case 'bottom-left':
        x = 30;
        break;
      case 'bottom-right':
        x = width - textWidth - 30;
        break;
      case 'bottom-center':
      default:
        x = (width - textWidth) / 2;
    }
    
    page.drawText(text, {
      x,
      y: 30,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Merge multiple PDFs into one
 */
export async function mergePDFs(
  pdfs: Array<ArrayBuffer | Uint8Array>
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  for (const pdfData of pdfs) {
    const pdf = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    
    for (const page of pages) {
      mergedPdf.addPage(page);
    }
  }
  
  return mergedPdf.save();
}

/**
 * Split a PDF into individual pages
 */
export async function splitPDF(
  pdfData: ArrayBuffer | Uint8Array
): Promise<Uint8Array[]> {
  const pdf = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const pageCount = pdf.getPageCount();
  const results: Uint8Array[] = [];
  
  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdf, [i]);
    newPdf.addPage(page);
    results.push(await newPdf.save());
  }
  
  return results;
}

/**
 * Get PDF metadata
 */
export async function getPDFMetadata(
  pdfData: ArrayBuffer | Uint8Array
): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}> {
  const pdf = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  
  return {
    pageCount: pdf.getPageCount(),
    title: pdf.getTitle() || undefined,
    author: pdf.getAuthor() || undefined,
    subject: pdf.getSubject() || undefined,
    creator: pdf.getCreator() || undefined,
    producer: pdf.getProducer() || undefined,
    creationDate: pdf.getCreationDate() || undefined,
    modificationDate: pdf.getModificationDate() || undefined,
  };
}
