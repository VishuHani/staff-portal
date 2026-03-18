// ============================================================================
// AI DOCUMENT ANALYSIS SERVICE
// Analyzes uploaded PDF documents to check if they are properly filled
// ============================================================================

import OpenAI from 'openai';
import { 
  DocumentAnalysisResult, 
  AnalyzeDocumentRequest,
  AnalysisStatus,
  DetectedField,
  AnalysisIssue,
  DocumentValidationRule
} from '@/lib/types/document-analysis';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a document to check if it's properly filled
 */
export async function analyzeDocument(
  request: AnalyzeDocumentRequest
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Step 1: Extract content from PDF
    const extractedContent = await extractPdfContent(request.pdfUrl);
    
    // Step 2: Analyze with AI
    const aiAnalysis = await analyzeWithAI(
      extractedContent,
      request.validationRules || [],
      request.options
    );
    
    // Step 3: Build result
    const processingTimeMs = Date.now() - startTime;
    
    const result: DocumentAnalysisResult = {
      id: analysisId,
      submissionId: request.submissionId,
      status: 'COMPLETED',
      completenessScore: aiAnalysis.completenessScore,
      confidenceScore: aiAnalysis.confidenceScore,
      detectedFields: aiAnalysis.detectedFields,
      detectedText: extractedContent.text,
      issues: aiAnalysis.issues,
      summary: aiAnalysis.summary,
      analyzedAt: new Date(),
      processingTimeMs,
      modelUsed: 'gpt-4o',
      rawResponse: aiAnalysis.rawResponse,
    };
    
    return result;
  } catch (error) {
    console.error('Document analysis failed:', error);
    
    return {
      id: analysisId,
      submissionId: request.submissionId,
      status: 'FAILED',
      completenessScore: 0,
      confidenceScore: 0,
      detectedFields: [],
      detectedText: [],
      issues: [{
        id: 'analysis_error',
        type: 'invalid',
        severity: 'error',
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 1,
      }],
      summary: {
        totalFields: 0,
        filledFields: 0,
        validFields: 0,
        missingFields: 0,
        invalidFields: 0,
      },
      analyzedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'gpt-4o',
    };
  }
}

// ============================================================================
// PDF CONTENT EXTRACTION
// ============================================================================

interface ExtractedContent {
  text: string[];
  pages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
  };
}

/**
 * Extract text content from PDF
 * In production, this would use pdf-parse or similar library
 */
async function extractPdfContent(pdfUrl: string): Promise<ExtractedContent> {
  try {
    // For now, we'll use the AI to extract content from the PDF image
    // In production, you'd use pdf-parse or pdf-lib for text extraction
    
    // Fetch the PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    // Convert to base64 for AI processing
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Use AI to extract text (fallback approach)
    const extractionPrompt = `Extract all text content from this PDF document. 
Return a JSON object with:
- "text": array of text strings found in the document
- "pages": estimated number of pages
- "hasFormFields": boolean indicating if form fields are detected
- "hasSignatures": boolean indicating if signature areas are detected`;

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: extractionPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = aiResponse.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        text: parsed.text || [],
        pages: parsed.pages || 1,
        metadata: {},
      };
    }
    
    return {
      text: [],
      pages: 1,
      metadata: {},
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      text: [],
      pages: 1,
      metadata: {},
    };
  }
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

interface AIAnalysisResult {
  completenessScore: number;
  confidenceScore: number;
  detectedFields: DetectedField[];
  issues: AnalysisIssue[];
  summary: {
    totalFields: number;
    filledFields: number;
    validFields: number;
    missingFields: number;
    invalidFields: number;
  };
  rawResponse?: unknown;
}

async function analyzeWithAI(
  extractedContent: ExtractedContent,
  validationRules: DocumentValidationRule[],
  options?: AnalyzeDocumentRequest['options']
): Promise<AIAnalysisResult> {
  // Build the analysis prompt
  const systemPrompt = `You are a document analysis AI specialized in checking if forms and documents are properly filled.

Your task is to:
1. Identify all form fields in the document
2. Check if each field is filled
3. Validate the filled values against any provided rules
4. Calculate a completeness score (0-100)
5. Provide a confidence score (0-1) for your analysis

Respond with a JSON object containing:
{
  "completenessScore": number (0-100),
  "confidenceScore": number (0-1),
  "detectedFields": [
    {
      "id": "field_id",
      "label": "Field Label",
      "type": "text|checkbox|signature|date|select",
      "value": "detected value",
      "isFilled": boolean,
      "isValid": boolean,
      "confidence": number (0-1)
    }
  ],
  "issues": [
    {
      "id": "issue_id",
      "fieldId": "field_id (if applicable)",
      "fieldName": "Field name",
      "type": "missing|incomplete|invalid|unreadable|mismatch",
      "severity": "error|warning|info",
      "message": "Description of the issue",
      "suggestion": "How to fix it",
      "confidence": number (0-1)
    }
  ],
  "summary": {
    "totalFields": number,
    "filledFields": number,
    "validFields": number,
    "missingFields": number,
    "invalidFields": number
  }
}`;

  const validationRulesText = validationRules.length > 0
    ? `\n\nValidation Rules:\n${validationRules.map(rule => 
        `- ${rule.fieldName} (${rule.fieldType}): ${rule.required ? 'Required' : 'Optional'}${rule.expectedValue ? `, Expected: ${rule.expectedValue}` : ''}${rule.regexPattern ? `, Pattern: ${rule.regexPattern}` : ''}`
      ).join('\n')}`
    : '';

  const userPrompt = `Analyze this document for completeness and validity.

Extracted text content:
${extractedContent.text.join('\n')}

Total pages: ${extractedContent.pages}
${validationRulesText}

Provide your analysis as a JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent analysis
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    
    // Ensure all detected fields have required properties
    const detectedFields: DetectedField[] = (parsed.detectedFields || []).map((field: Partial<DetectedField>, index: number) => ({
      id: field.id || `field_${index}`,
      label: field.label || 'Unknown Field',
      type: field.type || 'text',
      value: field.value,
      isFilled: field.isFilled ?? false,
      isValid: field.isValid ?? false,
      confidence: field.confidence ?? 0.5,
    }));

    // Ensure all issues have required properties
    const issues: AnalysisIssue[] = (parsed.issues || []).map((issue: Partial<AnalysisIssue>, index: number) => ({
      id: issue.id || `issue_${index}`,
      fieldId: issue.fieldId,
      fieldName: issue.fieldName,
      type: issue.type || 'missing',
      severity: issue.severity || 'warning',
      message: issue.message || 'Unknown issue',
      suggestion: issue.suggestion,
      confidence: issue.confidence ?? 0.5,
    }));

    return {
      completenessScore: Math.min(100, Math.max(0, parsed.completenessScore || 0)),
      confidenceScore: Math.min(1, Math.max(0, parsed.confidenceScore || 0)),
      detectedFields,
      issues,
      summary: parsed.summary || {
        totalFields: detectedFields.length,
        filledFields: detectedFields.filter(f => f.isFilled).length,
        validFields: detectedFields.filter(f => f.isValid).length,
        missingFields: detectedFields.filter(f => !f.isFilled).length,
        invalidFields: detectedFields.filter(f => !f.isValid).length,
      },
      rawResponse: parsed,
    };
  } catch (error) {
    console.error('AI analysis error:', error);
    
    // Return a basic result on error
    return {
      completenessScore: 0,
      confidenceScore: 0,
      detectedFields: [],
      issues: [{
        id: 'ai_error',
        type: 'invalid',
        severity: 'error',
        message: 'Failed to analyze document with AI',
        confidence: 1,
      }],
      summary: {
        totalFields: 0,
        filledFields: 0,
        validFields: 0,
        missingFields: 0,
        invalidFields: 0,
      },
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick analysis for simple completeness check
 */
export async function quickAnalysisCheck(pdfUrl: string): Promise<{
  isComplete: boolean;
  completenessScore: number;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Look at this document and quickly assess if it appears to be completely filled out.
Return a JSON object with:
- "isComplete": boolean (true if all visible form fields appear to be filled)
- "completenessScore": number (0-100, estimated percentage of completion)
- "confidence": number (0-1, how confident you are in this assessment)`,
            },
            {
              type: 'image_url',
              image_url: { url: pdfUrl },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Quick analysis error:', error);
  }

  return {
    isComplete: false,
    completenessScore: 0,
    confidence: 0,
  };
}

/**
 * Generate validation rules from a template PDF
 */
export async function generateValidationRules(pdfUrl: string): Promise<DocumentValidationRule[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this blank form template and identify all form fields that need to be filled.
Return a JSON array of fields with:
- "fieldId": unique identifier
- "fieldName": label or name of the field
- "fieldType": "text", "checkbox", "signature", "date", or "select"
- "required": boolean (true if the field appears to be required)
- "expectedValue": optional expected value or format`,
            },
            {
              type: 'image_url',
              image_url: { url: pdfUrl },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return parsed.fields || [];
    }
  } catch (error) {
    console.error('Validation rule generation error:', error);
  }

  return [];
}

export default {
  analyzeDocument,
  quickAnalysisCheck,
  generateValidationRules,
};
