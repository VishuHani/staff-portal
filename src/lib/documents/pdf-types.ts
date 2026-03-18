/**
 * PDF Processing Types for Document Management System
 * 
 * This module defines TypeScript types for PDF processing,
 * including field extraction, mapping, and generation.
 */

// ============================================================================
// PDF FIELD TYPES
// ============================================================================

/**
 * PDF form field types as defined by PDF specification
 */
export type PDFFormFieldType = 
  | 'text'      // Text input field
  | 'checkbox'  // Checkbox field
  | 'radio'     // Radio button group
  | 'dropdown'  // Dropdown/combobox
  | 'signature' // Signature field
  | 'button'    // Push button
  | 'unknown';  // Unknown or unsupported type

/**
 * Extracted PDF form field
 */
export interface ExtractedPDFField {
  /** Unique identifier for the field in the PDF */
  id: string;
  /** Field name as defined in the PDF */
  name: string;
  /** Field type */
  type: PDFFormFieldType;
  /** Current value of the field (if any) */
  value?: string | boolean | string[];
  /** Default value */
  defaultValue?: string | boolean | string[];
  /** Field is read-only */
  readOnly: boolean;
  /** Field is required */
  required: boolean;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Field position on the page */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Options for dropdown/radio fields */
  options?: PDFFieldOption[];
  /** Maximum length for text fields */
  maxLength?: number;
  /** Multi-line text field */
  multiLine?: boolean;
  /** Field description/tooltip */
  description?: string;
  /** Flag to indicate if field is fillable */
  isFillable: boolean;
}

/**
 * Option for dropdown/radio fields
 */
export interface PDFFieldOption {
  value: string;
  label: string;
  exportValue?: string;
}

// ============================================================================
// PDF FIELD MAPPING TYPES
// ============================================================================

/**
 * Prefill source for automatic field population
 */
export type PrefillSource = 
  | 'user.name'
  | 'user.email'
  | 'user.phone'
  | 'user.dateOfBirth'
  | 'user.addressStreet'
  | 'user.addressCity'
  | 'user.addressState'
  | 'user.addressPostcode'
  | 'user.addressCountry'
  | 'user.emergencyContactName'
  | 'user.emergencyContactPhone'
  | 'user.taxFileNumber'
  | 'user.bankAccountName'
  | 'user.bankBSB'
  | 'user.bankAccountNumber'
  | 'user.superFundName'
  | 'user.superMemberNumber'
  | 'venue.name'
  | 'venue.address'
  | 'venue.phone'
  | 'venue.email'
  | 'assignment.assignedDate'
  | 'assignment.dueDate'
  | 'custom';

/**
 * Field transformation types
 */
export type FieldTransformType = 
  | 'uppercase'
  | 'lowercase'
  | 'capitalize'
  | 'date_format'
  | 'phone_format'
  | 'custom';

/**
 * Field transformation configuration
 */
export interface FieldTransform {
  type: FieldTransformType;
  config?: Record<string, unknown>;
}

/**
 * PDF field to system field mapping
 */
export interface PDFFieldMapping {
  /** ID of the mapping */
  id: string;
  /** PDF field name */
  pdfFieldName: string;
  /** System field ID (from form schema) */
  systemFieldId?: string;
  /** Prefill source for automatic population */
  prefillSource?: PrefillSource;
  /** Custom value (when prefillSource is 'custom') */
  customValue?: string;
  /** Transformation to apply */
  transform?: FieldTransform;
  /** Whether this mapping is active */
  isActive: boolean;
  /** Order for processing */
  order: number;
}

/**
 * Complete field mapping configuration for a PDF template
 */
export interface PDFFieldMappingConfig {
  /** Template ID this mapping belongs to */
  templateId: string;
  /** PDF version this mapping was created for */
  pdfVersion: number;
  /** Field mappings */
  mappings: PDFFieldMapping[];
  /** When the mapping was created */
  createdAt: string;
  /** When the mapping was last updated */
  updatedAt: string;
  /** Who created the mapping */
  createdBy: string;
}

// ============================================================================
// PDF RENDERING TYPES
// ============================================================================

/**
 * PDF page render options
 */
export interface PDFRenderOptions {
  /** Scale factor for rendering */
  scale: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270;
  /** Whether to render text layer for selection */
  renderTextLayer: boolean;
  /** Whether to render annotation layer */
  renderAnnotationLayer: boolean;
  /** Background color */
  backgroundColor?: string;
}

/**
 * PDF page render result
 */
export interface PDFPageRender {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Canvas element with rendered page */
  canvas: HTMLCanvasElement;
  /** Text layer div (if rendered) */
  textLayer?: HTMLDivElement;
  /** Annotation layer div (if rendered) */
  annotationLayer?: HTMLDivElement;
  /** Page dimensions at rendered scale */
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * PDF thumbnail
 */
export interface PDFThumbnail {
  /** Page number */
  pageNumber: number;
  /** Thumbnail image URL (data URL or blob URL) */
  url: string;
  /** Thumbnail dimensions */
  width: number;
  height: number;
}

/**
 * PDF document info
 */
export interface PDFDocumentInfo {
  /** Number of pages */
  pageCount: number;
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Document subject */
  subject?: string;
  /** Document keywords */
  keywords?: string;
  /** Creator application */
  creator?: string;
  /** Producer application */
  producer?: string;
  /** Creation date */
  creationDate?: Date;
  /** Modification date */
  modificationDate?: Date;
  /** Whether PDF has form fields */
  hasFormFields: boolean;
  /** Whether PDF is encrypted */
  isEncrypted: boolean;
  /** Whether PDF is linearized (fast web view) */
  isLinearized: boolean;
  /** PDF version */
  pdfVersion?: string;
  /** Page dimensions (first page) */
  pageDimensions?: {
    width: number;
    height: number;
  };
}

// ============================================================================
// PDF UPLOAD TYPES
// ============================================================================

/**
 * PDF upload state
 */
export type PDFUploadStatus = 
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error';

/**
 * PDF upload progress
 */
export interface PDFUploadProgress {
  /** Current status */
  status: PDFUploadStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Bytes uploaded */
  bytesUploaded: number;
  /** Total bytes */
  bytesTotal: number;
  /** Error message (if status is 'error') */
  error?: string;
  /** Uploaded file URL (when complete) */
  url?: string;
  /** Extracted document info (when processing is complete) */
  documentInfo?: PDFDocumentInfo;
  /** Extracted form fields (when processing is complete) */
  formFields?: ExtractedPDFField[];
}

/**
 * PDF upload validation result
 */
export interface PDFValidationResult {
  /** Whether the file is valid */
  valid: boolean;
  /** Error messages */
  errors: string[];
  /** Warnings */
  warnings: string[];
  /** File size in bytes */
  fileSize: number;
  /** File name */
  fileName: string;
}

/**
 * PDF upload options
 */
export interface PDFUploadOptions {
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Allowed MIME types */
  allowedTypes?: string[];
  /** Storage path prefix */
  pathPrefix?: string;
  /** Whether to extract form fields after upload */
  extractFields?: boolean;
  /** Whether to generate thumbnails */
  generateThumbnails?: boolean;
  /** Thumbnail sizes to generate */
  thumbnailSizes?: { width: number; height: number }[];
}

// ============================================================================
// PDF GENERATION TYPES
// ============================================================================

/**
 * PDF field value for filling
 */
export interface PDFFieldValue {
  /** Field name in PDF */
  fieldName: string;
  /** Value to set */
  value: string | boolean | string[];
  /** Field type (for validation) */
  type: PDFFormFieldType;
}

/**
 * PDF generation options
 */
export interface PDFGenerationOptions {
  /** Whether to flatten the PDF after filling (make non-editable) */
  flatten: boolean;
  /** Whether to preserve form fields (if not flattening) */
  preserveFields?: boolean;
  /** Whether to add signature image */
  includeSignature?: boolean;
  /** Signature field name */
  signatureFieldName?: string;
  /** Signature image URL or base64 data */
  signatureImage?: string;
  /** Output file name */
  outputFileName?: string;
  /** Whether to compress the output */
  compress?: boolean;
}

/**
 * PDF generation result
 */
export interface PDFGenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Generated PDF as Blob */
  blob?: Blob;
  /** Generated PDF as ArrayBuffer */
  arrayBuffer?: ArrayBuffer;
  /** Generated PDF as base64 string */
  base64?: string;
  /** Download URL (if uploaded to storage) */
  url?: string;
  /** Error message (if failed) */
  error?: string;
  /** Number of fields filled */
  fieldsFilled: number;
  /** Number of fields that failed to fill */
  fieldsFailed: number;
  /** Failed field names */
  failedFields?: string[];
}

// ============================================================================
// PDF VIEWER STATE TYPES
// ============================================================================

/**
 * PDF viewer state
 */
export interface PDFViewerState {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Zoom level */
  scale: number;
  /** Rotation */
  rotation: 0 | 90 | 180 | 270;
  /** Whether in fullscreen mode */
  isFullscreen: boolean;
  /** Whether thumbnails sidebar is visible */
  showThumbnails: boolean;
  /** Whether the document is loading */
  isLoading: boolean;
  /** Loading progress */
  loadingProgress: number;
  /** Error message */
  error?: string;
  /** Search query */
  searchQuery?: string;
  /** Current search match index */
  currentMatchIndex?: number;
  /** Total search matches */
  totalMatches?: number;
}

/**
 * PDF viewer configuration
 */
export interface PDFViewerConfig {
  /** Initial zoom level */
  initialScale?: number;
  /** Minimum zoom level */
  minScale?: number;
  /** Maximum zoom level */
  maxScale?: number;
  /** Zoom step for zoom in/out */
  zoomStep?: number;
  /** Whether to show thumbnails sidebar by default */
  showThumbnails?: boolean;
  /** Thumbnail width */
  thumbnailWidth?: number;
  /** Whether to enable text selection */
  enableTextSelection?: boolean;
  /** Whether to enable print */
  enablePrint?: boolean;
  /** Whether to enable download */
  enableDownload?: boolean;
  /** Whether to enable fullscreen */
  enableFullscreen?: boolean;
  /** Whether to enable search */
  enableSearch?: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Map PDF field type to form schema field type
 */
export function mapPDFFieldTypeToFormFieldType(pdfType: PDFFormFieldType): string {
  const mapping: Record<PDFFormFieldType, string> = {
    text: 'text',
    checkbox: 'checkbox',
    radio: 'radio',
    dropdown: 'select',
    signature: 'signature',
    button: 'text', // Buttons are typically not mapped
    unknown: 'text',
  };
  return mapping[pdfType];
}

/**
 * Check if a PDF field type is fillable
 */
export function isPDFFieldFillable(type: PDFFormFieldType): boolean {
  return ['text', 'checkbox', 'radio', 'dropdown', 'signature'].includes(type);
}

/**
 * Get prefill source display name
 */
export function getPrefillSourceDisplayName(source: PrefillSource): string {
  const displayNames: Record<PrefillSource, string> = {
    'user.name': 'User Name',
    'user.email': 'User Email',
    'user.phone': 'User Phone',
    'user.dateOfBirth': 'Date of Birth',
    'user.addressStreet': 'Street Address',
    'user.addressCity': 'City',
    'user.addressState': 'State/Province',
    'user.addressPostcode': 'Postal Code',
    'user.addressCountry': 'Country',
    'user.emergencyContactName': 'Emergency Contact Name',
    'user.emergencyContactPhone': 'Emergency Contact Phone',
    'user.taxFileNumber': 'Tax File Number',
    'user.bankAccountName': 'Bank Account Name',
    'user.bankBSB': 'Bank BSB',
    'user.bankAccountNumber': 'Bank Account Number',
    'user.superFundName': 'Superannuation Fund Name',
    'user.superMemberNumber': 'Superannuation Member Number',
    'venue.name': 'Venue Name',
    'venue.address': 'Venue Address',
    'venue.phone': 'Venue Phone',
    'venue.email': 'Venue Email',
    'assignment.assignedDate': 'Assignment Date',
    'assignment.dueDate': 'Due Date',
    'custom': 'Custom Value',
  };
  return displayNames[source];
}

/**
 * Get all available prefill sources
 */
export function getAvailablePrefillSources(): PrefillSource[] {
  return [
    'user.name',
    'user.email',
    'user.phone',
    'user.dateOfBirth',
    'user.addressStreet',
    'user.addressCity',
    'user.addressState',
    'user.addressPostcode',
    'user.addressCountry',
    'user.emergencyContactName',
    'user.emergencyContactPhone',
    'user.taxFileNumber',
    'user.bankAccountName',
    'user.bankBSB',
    'user.bankAccountNumber',
    'user.superFundName',
    'user.superMemberNumber',
    'venue.name',
    'venue.address',
    'venue.phone',
    'venue.email',
    'assignment.assignedDate',
    'assignment.dueDate',
    'custom',
  ];
}

/**
 * Default PDF upload options
 */
export const DEFAULT_PDF_UPLOAD_OPTIONS: PDFUploadOptions = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['application/pdf'],
  pathPrefix: 'document-uploads/templates',
  extractFields: true,
  generateThumbnails: true,
  thumbnailSizes: [{ width: 200, height: 280 }],
};

/**
 * Default PDF viewer configuration
 */
export const DEFAULT_PDF_VIEWER_CONFIG: PDFViewerConfig = {
  initialScale: 1.0,
  minScale: 0.25,
  maxScale: 4.0,
  zoomStep: 0.25,
  showThumbnails: true,
  thumbnailWidth: 150,
  enableTextSelection: true,
  enablePrint: true,
  enableDownload: true,
  enableFullscreen: true,
  enableSearch: true,
};

/**
 * Default PDF render options
 */
export const DEFAULT_PDF_RENDER_OPTIONS: PDFRenderOptions = {
  scale: 1.0,
  rotation: 0,
  renderTextLayer: true,
  renderAnnotationLayer: true,
  backgroundColor: '#ffffff',
};
