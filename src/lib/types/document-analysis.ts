// ============================================================================
// DOCUMENT ANALYSIS TYPES
// ============================================================================

/**
 * Status of AI document analysis
 */
export type AnalysisStatus = 
  | 'PENDING'      // Analysis not started
  | 'ANALYZING'    // Analysis in progress
  | 'COMPLETED'    // Analysis completed successfully
  | 'FAILED';      // Analysis failed

/**
 * Severity of an analysis issue
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * A single issue detected during document analysis
 */
export interface AnalysisIssue {
  id: string;
  fieldId?: string;           // Reference to form field if applicable
  fieldName?: string;         // Human-readable field name
  type: 'missing' | 'incomplete' | 'invalid' | 'unreadable' | 'mismatch';
  severity: IssueSeverity;
  message: string;
  suggestion?: string;        // Suggested fix
  position?: {                // Position on document (if detectable)
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;         // 0-1 confidence in this detection
}

/**
 * A field detected in the document
 */
export interface DetectedField {
  id: string;
  label: string;
  type: 'text' | 'checkbox' | 'signature' | 'date' | 'select';
  value?: string;
  isFilled: boolean;
  isValid: boolean;
  position?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

/**
 * Result of AI document analysis
 */
export interface DocumentAnalysisResult {
  id: string;
  submissionId: string;
  status: AnalysisStatus;
  
  // Overall scores
  completenessScore: number;   // 0-100 how complete the document is
  confidenceScore: number;     // 0-1 how confident the AI is in its analysis
  
  // Detected content
  detectedFields: DetectedField[];
  detectedText: string[];      // Extracted text content
  
  // Issues found
  issues: AnalysisIssue[];
  
  // Summary
  summary: {
    totalFields: number;
    filledFields: number;
    validFields: number;
    missingFields: number;
    invalidFields: number;
  };
  
  // Metadata
  analyzedAt: Date;
  processingTimeMs: number;
  modelUsed: string;
  
  // Raw AI response (for debugging)
  rawResponse?: unknown;
}

/**
 * Request to analyze a document
 */
export interface AnalyzeDocumentRequest {
  submissionId: string;
  pdfUrl: string;
  templateId: string;
  validationRules?: DocumentValidationRule[];
  options?: AnalysisOptions;
}

/**
 * Validation rule for document field
 */
export interface DocumentValidationRule {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'checkbox' | 'signature' | 'date' | 'select';
  required: boolean;
  expectedValue?: string;
  regexPattern?: string;
  position?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Options for document analysis
 */
export interface AnalysisOptions {
  extractText?: boolean;       // Whether to extract all text
  detectFields?: boolean;      // Whether to detect form fields
  validateFields?: boolean;    // Whether to validate against rules
  ocrEnabled?: boolean;        // Whether to use OCR for scanned docs
  language?: string;           // Document language (default: 'en')
}

/**
 * Status response for analysis
 */
export interface AnalysisStatusResponse {
  submissionId: string;
  status: AnalysisStatus;
  completenessScore?: number;
  confidenceScore?: number;
  issuesCount?: number;
  analyzedAt?: Date;
  error?: string;
}

// ============================================================================
// PRINT & FILL DOCUMENT TYPES
// ============================================================================

/**
 * Print & Fill document template
 */
export interface PrintFillTemplate {
  id: string;
  name: string;
  description?: string;
  pdfUrl: string;
  pdfFileName: string;
  pdfFileSize: number;
  validationRules: DocumentValidationRule[];
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Print & Fill submission
 */
export interface PrintFillSubmission {
  id: string;
  templateId: string;
  userId: string;
  assignmentId: string;
  
  // Uploaded document
  uploadedPdfUrl: string;
  uploadedFileName: string;
  uploadedFileSize: number;
  uploadedAt: Date;
  
  // Analysis results
  analysisStatus: AnalysisStatus;
  analysisResult?: DocumentAnalysisResult;
  
  // Status
  status: 'pending' | 'analyzing' | 'complete' | 'incomplete' | 'failed';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upload result for print & fill document
 */
export interface PrintFillUploadResult {
  success: boolean;
  submissionId?: string;
  uploadUrl?: string;
  error?: string;
}
