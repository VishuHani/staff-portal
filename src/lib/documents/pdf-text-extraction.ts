/**
 * Server-Side PDF Form Field Detection
 * 
 * Uses OpenAI GPT-4o's native PDF support to analyze PDFs and extract form fields.
 * No image conversion needed - PDFs are sent directly to the API.
 */

import OpenAI from 'openai';
import type { FormField } from '@/lib/types/form-schema';

/**
 * Result of PDF form field detection
 */
export interface PDFFormDetectionResult {
  fields: FormField[];
  documentTitle: string;
  documentDescription: string;
  fullText: string;
  pageCount: number;
}

/**
 * Extract form fields from a PDF using GPT-4o's native PDF support
 * Sends the PDF directly to OpenAI without any conversion
 */
export async function detectFormFieldsFromPDF(
  pdfData: ArrayBuffer | Uint8Array | Buffer,
  fileName?: string
): Promise<PDFFormDetectionResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Convert to Buffer if needed
    let buffer: Buffer;
    if (pdfData instanceof ArrayBuffer) {
      buffer = Buffer.from(pdfData);
    } else if (pdfData instanceof Uint8Array) {
      buffer = Buffer.from(pdfData);
    } else {
      buffer = pdfData;
    }

    console.log('[PDF Field Detection] Sending PDF directly to GPT-4o...');
    console.log(`[PDF Field Detection] PDF size: ${buffer.length} bytes`);

    // Convert PDF to base64
    const pdfBase64 = buffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

    // Send PDF directly to GPT-4o using the file content type
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert form analyzer. Your task is to analyze PDF documents and extract ALL form fields that need to be filled in.

Analyze the document and identify:
1. All input fields (text boxes, checkboxes, radio buttons, dropdowns)
2. Field labels and their corresponding input areas
3. Required vs optional fields
4. Appropriate field types (text, email, phone, date, signature, etc.)

Return a JSON object with this EXACT structure:
{
  "documentTitle": "Title of the document",
  "documentDescription": "Brief description of what this form is for",
  "fullText": "All text content from the document (labels, instructions, etc.)",
  "pageCount": number_of_pages,
  "fields": [
    {
      "id": "unique_field_id_using_underscores",
      "type": "text|textarea|email|phone|date|time|number|checkbox|select|radio|signature|file",
      "label": "The field label as shown in the document",
      "placeholder": "Appropriate placeholder text",
      "required": true_or_false,
      "options": [{"value": "x", "label": "Option Label"}]
    }
  ]
}

IMPORTANT RULES:
1. Extract EVERY field that needs user input - don't skip any
2. Use appropriate field types:
   - "text" for names, addresses, general text
   - "email" for email fields
   - "phone" for phone numbers
   - "date" for dates
   - "number" for numeric inputs
   - "checkbox" for yes/no or single selections
   - "select" for dropdown menus
   - "radio" for multiple choice with one answer
   - "signature" for signature fields
   - "textarea" for long text/multiple lines
3. Create meaningful field IDs from the labels (e.g., "first_name", "emergency_contact_phone")
4. Mark fields as required if they have asterisks or "required" indicators
5. For checkboxes, include options with value and label
6. Return ONLY valid JSON - no markdown, no code blocks, no comments`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: fileName || 'document.pdf',
                file_data: dataUrl,
              },
            },
            {
              type: 'text',
              text: `Analyze this PDF document and extract ALL form fields that need to be filled in. Return a complete JSON with all detected fields.`,
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from GPT-4o');
    }

    console.log('[PDF Field Detection] Raw response length:', content.length);

    // Parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    // Transform to FormField format with all required properties
    const fields: FormField[] = (result.fields || []).map((field: any, index: number) => ({
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
    }));

    console.log(`[PDF Field Detection] Detected ${fields.length} fields`);

    return {
      fields,
      documentTitle: result.documentTitle || 'Untitled Form',
      documentDescription: result.documentDescription || '',
      fullText: result.fullText || '',
      pageCount: result.pageCount || 1,
    };
  } catch (error) {
    console.error('[PDF Field Detection] Error:', error);
    
    // Return empty result on error
    return {
      fields: [],
      documentTitle: 'Error Processing PDF',
      documentDescription: error instanceof Error ? error.message : 'Unknown error',
      fullText: '',
      pageCount: 1,
    };
  }
}

/**
 * Extract text with page information for AI analysis
 */
export async function extractPDFTextForAI(
  pdfData: ArrayBuffer | Uint8Array | Buffer,
  fileName?: string
): Promise<{
  text: string;
  pageCount: number;
  pageTexts: string[];
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
  };
}> {
  const result = await detectFormFieldsFromPDF(pdfData, fileName);
  
  return {
    text: result.fullText,
    pageCount: result.pageCount,
    pageTexts: [result.fullText],
    metadata: {
      title: result.documentTitle,
      subject: result.documentDescription,
    },
  };
}

/**
 * Get basic PDF text content (simplified extraction)
 */
export async function getPDFTextContent(
  pdfData: ArrayBuffer | Uint8Array | Buffer,
  maxPages?: number,
  fileName?: string
): Promise<{ text: string; pageCount: number }> {
  const result = await extractPDFTextForAI(pdfData, fileName);
  return {
    text: result.text,
    pageCount: result.pageCount,
  };
}

/**
 * Extract text from a local PDF file
 */
export async function extractTextFromLocalPDF(
  filePath: string
): Promise<{ text: string; pageCount: number; fields: FormField[] }> {
  const { readFile } = await import('fs/promises');
  const path = await import('path');
  
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), 'public', filePath);

  const buffer = await readFile(absolutePath);
  const result = await detectFormFieldsFromPDF(buffer, path.basename(filePath));
  
  return {
    text: result.fullText,
    pageCount: result.pageCount,
    fields: result.fields,
  };
}
