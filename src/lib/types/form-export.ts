/**
 * Form Export Types for Document Management System
 * 
 * This module defines the TypeScript types for exporting forms
 * to various formats including PDF, Word, Excel, and HTML.
 */

import { FormSchema, FormField, FormData } from './form-schema';
import { FormTheme } from './form-theme';

// ============================================================================
// PDF EXPORT TYPES
// ============================================================================

/**
 * PDF page size options
 */
export type PDFPageSize = 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';

/**
 * PDF orientation options
 */
export type PDFOrientation = 'portrait' | 'landscape';

/**
 * PDF export layout type
 */
export type PDFLayoutType = 'form' | 'submission' | 'summary' | 'blank';

/**
 * PDF header configuration
 */
export interface PDFHeaderConfig {
  /** Header text */
  text?: string;
  /** Include logo */
  includeLogo?: boolean;
  /** Logo URL */
  logoUrl?: string;
  /** Logo max height in pixels */
  logoMaxHeight?: number;
  /** Include date */
  includeDate?: boolean;
  /** Include page numbers */
  includePageNumbers?: boolean;
  /** Include form title */
  includeTitle?: boolean;
  /** Header background color */
  backgroundColor?: string;
  /** Header text color */
  textColor?: string;
}

/**
 * PDF footer configuration
 */
export interface PDFFooterConfig {
  /** Footer text */
  text?: string;
  /** Include timestamp */
  includeTimestamp?: boolean;
  /** Include page numbers */
  includePageNumbers?: boolean;
  /** Include confidentiality notice */
  includeConfidentiality?: boolean;
  /** Footer background color */
  backgroundColor?: string;
  /** Footer text color */
  textColor?: string;
}

/**
 * PDF export options
 */
export interface PDFExportOptions {
  /** Layout type */
  layout: PDFLayoutType;
  /** Page size */
  pageSize: PDFPageSize;
  /** Orientation */
  orientation: PDFOrientation;
  
  /** Theme to apply */
  theme?: FormTheme;
  /** Include branding */
  includeBranding?: boolean;
  
  /** Content options */
  content: {
    /** Include empty fields */
    includeEmptyFields?: boolean;
    /** Include field descriptions */
    includeFieldDescriptions?: boolean;
    /** Include help text */
    includeHelpText?: boolean;
    /** Include field IDs */
    includeFieldIds?: boolean;
    /** Include validation rules */
    includeValidationRules?: boolean;
    /** Include conditional logic info */
    includeConditionalLogic?: boolean;
  };
  
  /** Header configuration */
  header?: PDFHeaderConfig;
  /** Footer configuration */
  footer?: PDFFooterConfig;
  
  /** Margins in mm */
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  
  /** Security options */
  security?: {
    /** Password to open */
    password?: string;
    /** Watermark text */
    watermark?: string;
    /** Allow printing */
    allowPrinting?: boolean;
    /** Allow copying */
    allowCopying?: boolean;
  };
  
  /** Custom CSS for PDF */
  customCSS?: string;
}

/**
 * PDF export result
 */
export interface PDFExportResult {
  /** PDF blob */
  blob: Blob;
  /** File name */
  filename: string;
  /** Number of pages */
  pageCount: number;
  /** File size in bytes */
  fileSize: number;
  /** Generation timestamp */
  generatedAt: Date;
}

// ============================================================================
// WORD EXPORT TYPES
// ============================================================================

/**
 * Word export options
 */
export interface WordExportOptions {
  /** Include form fields */
  includeFields?: boolean;
  /** Include field descriptions */
  includeDescriptions?: boolean;
  /** Include help text */
  includeHelpText?: boolean;
  /** Include validation rules */
  includeValidation?: boolean;
  /** Document title */
  title?: string;
  /** Author */
  author?: string;
  /** Subject */
  subject?: string;
  /** Keywords */
  keywords?: string[];
}

/**
 * Word export result
 */
export interface WordExportResult {
  /** Document blob */
  blob: Blob;
  /** File name */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** Generated at */
  generatedAt: Date;
}

// ============================================================================
// EXCEL/CSV EXPORT TYPES
// ============================================================================

/**
 * Excel export options
 */
export interface ExcelExportOptions {
  /** Sheet name */
  sheetName?: string;
  /** Include headers */
  includeHeaders?: boolean;
  /** Include field types */
  includeFieldTypes?: boolean;
  /** Include validation */
  includeValidation?: boolean;
  /** Include options for select fields */
  includeOptions?: boolean;
  /** Date format */
  dateFormat?: string;
  /** Include empty rows */
  includeEmptyRows?: boolean;
}

/**
 * CSV export options
 */
export interface CSVExportOptions {
  /** Delimiter character */
  delimiter?: ',' | ';' | '\t' | '|';
  /** Include headers */
  includeHeaders?: boolean;
  /** Quote character */
  quoteChar?: '"' | "'";
  /** Escape character */
  escapeChar?: '\\' | '"';
  /** Line ending */
  lineEnding?: '\n' | '\r\n';
  /** Encoding */
  encoding?: 'utf-8' | 'utf-16' | 'ascii';
  /** Include BOM for UTF-8 */
  includeBOM?: boolean;
}

/**
 * Excel/CSV export result
 */
export interface SpreadsheetExportResult {
  /** File blob */
  blob: Blob;
  /** File name */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** Number of rows */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Generated at */
  generatedAt: Date;
}

// ============================================================================
// HTML EXPORT TYPES
// ============================================================================

/**
 * HTML export options
 */
export interface HTMLExportOptions {
  /** Include CSS */
  includeCSS?: boolean;
  /** Include JavaScript */
  includeJavaScript?: boolean;
  /** Make it printable */
  printable?: boolean;
  /** Responsive design */
  responsive?: boolean;
  /** Include form validation */
  includeValidation?: boolean;
  /** Theme to apply */
  theme?: FormTheme;
  /** Custom CSS */
  customCSS?: string;
  /** Embed images as base64 */
  embedImages?: boolean;
  /** Minify output */
  minify?: boolean;
}

/**
 * HTML export result
 */
export interface HTMLExportResult {
  /** HTML content */
  html: string;
  /** File blob */
  blob: Blob;
  /** File name */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** Generated at */
  generatedAt: Date;
}

// ============================================================================
// JSON EXPORT TYPES
// ============================================================================

/**
 * JSON export options
 */
export interface JSONExportOptions {
  /** Pretty print */
  prettyPrint?: boolean;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Include theme */
  includeTheme?: boolean;
  /** Include validation rules */
  includeValidation?: boolean;
  /** Include conditional logic */
  includeConditionalLogic?: boolean;
  /** Include default values */
  includeDefaults?: boolean;
  /** Schema version */
  schemaVersion?: string;
}

/**
 * JSON export result
 */
export interface JSONExportResult {
  /** JSON string */
  json: string;
  /** Parsed object */
  data: Record<string, unknown>;
  /** File blob */
  blob: Blob;
  /** File name */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** Generated at */
  generatedAt: Date;
}

// ============================================================================
// EXPORT FORMAT TYPES
// ============================================================================

/**
 * All supported export formats
 */
export type ExportFormat = 'pdf' | 'word' | 'excel' | 'csv' | 'html' | 'json';

/**
 * Export options union type
 */
export type ExportOptions = 
  | PDFExportOptions 
  | WordExportOptions 
  | ExcelExportOptions 
  | CSVExportOptions 
  | HTMLExportOptions 
  | JSONExportOptions;

/**
 * Export result union type
 */
export type ExportResult = 
  | PDFExportResult 
  | WordExportResult 
  | SpreadsheetExportResult 
  | HTMLExportResult 
  | JSONExportResult;

/**
 * Export configuration for batch exports
 */
export interface ExportConfig {
  /** Export format */
  format: ExportFormat;
  /** Format-specific options */
  options: ExportOptions;
  /** Output filename (without extension) */
  filename?: string;
  /** Include timestamp in filename */
  includeTimestamp?: boolean;
}

// ============================================================================
// PRINT OPTIONS
// ============================================================================

/**
 * Print options
 */
export interface PrintOptions {
  /** Paper size */
  paperSize?: PDFPageSize;
  /** Orientation */
  orientation?: PDFOrientation;
  /** Margins */
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Scale (0.1 to 2) */
  scale?: number;
  /** Print background */
  printBackground?: boolean;
  /** Print headers and footers */
  printHeadersFooters?: boolean;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

/**
 * Default PDF export options
 */
export const DEFAULT_PDF_OPTIONS: PDFExportOptions = {
  layout: 'form',
  pageSize: 'A4',
  orientation: 'portrait',
  includeBranding: true,
  content: {
    includeEmptyFields: false,
    includeFieldDescriptions: true,
    includeHelpText: true,
    includeFieldIds: false,
    includeValidationRules: false,
    includeConditionalLogic: false,
  },
  header: {
    includeTitle: true,
    includeDate: true,
    includePageNumbers: true,
  },
  footer: {
    includeTimestamp: true,
    includePageNumbers: true,
    includeConfidentiality: false,
  },
  margins: {
    top: 20,
    right: 15,
    bottom: 20,
    left: 15,
  },
};

/**
 * Default Word export options
 */
export const DEFAULT_WORD_OPTIONS: WordExportOptions = {
  includeFields: true,
  includeDescriptions: true,
  includeHelpText: true,
  includeValidation: false,
};

/**
 * Default Excel export options
 */
export const DEFAULT_EXCEL_OPTIONS: ExcelExportOptions = {
  sheetName: 'Form Fields',
  includeHeaders: true,
  includeFieldTypes: true,
  includeValidation: false,
  includeOptions: true,
};

/**
 * Default CSV export options
 */
export const DEFAULT_CSV_OPTIONS: CSVExportOptions = {
  delimiter: ',',
  includeHeaders: true,
  quoteChar: '"',
  escapeChar: '"',
  lineEnding: '\n',
  encoding: 'utf-8',
  includeBOM: true,
};

/**
 * Default HTML export options
 */
export const DEFAULT_HTML_OPTIONS: HTMLExportOptions = {
  includeCSS: true,
  includeJavaScript: false,
  printable: true,
  responsive: true,
  includeValidation: true,
  embedImages: false,
  minify: false,
};

/**
 * Default JSON export options
 */
export const DEFAULT_JSON_OPTIONS: JSONExportOptions = {
  prettyPrint: true,
  includeMetadata: true,
  includeTheme: false,
  includeValidation: true,
  includeConditionalLogic: true,
  includeDefaults: true,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get file extension for export format
 */
export function getFileExtension(format: ExportFormat): string {
  const extensions: Record<ExportFormat, string> = {
    pdf: '.pdf',
    word: '.docx',
    excel: '.xlsx',
    csv: '.csv',
    html: '.html',
    json: '.json',
  };
  return extensions[format];
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
  const mimeTypes: Record<ExportFormat, string> = {
    pdf: 'application/pdf',
    word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    html: 'text/html',
    json: 'application/json',
  };
  return mimeTypes[format];
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  formName: string,
  format: ExportFormat,
  includeTimestamp: boolean = true
): string {
  const sanitizedName = formName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const timestamp = includeTimestamp 
    ? `_${new Date().toISOString().split('T')[0]}` 
    : '';
  
  return `${sanitizedName}${timestamp}${getFileExtension(format)}`;
}

/**
 * Get default options for format
 */
export function getDefaultOptions(format: ExportFormat): ExportOptions {
  switch (format) {
    case 'pdf':
      return DEFAULT_PDF_OPTIONS;
    case 'word':
      return DEFAULT_WORD_OPTIONS;
    case 'excel':
      return DEFAULT_EXCEL_OPTIONS;
    case 'csv':
      return DEFAULT_CSV_OPTIONS;
    case 'html':
      return DEFAULT_HTML_OPTIONS;
    case 'json':
      return DEFAULT_JSON_OPTIONS;
    default:
      return DEFAULT_PDF_OPTIONS;
  }
}