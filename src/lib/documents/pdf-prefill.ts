/**
 * PDF Field Pre-population Service
 * 
 * This module provides functionality to pre-fill PDF form fields with known user data.
 * It supports transformation functions and generates pre-filled PDFs.
 */

import { PDFDocument } from 'pdf-lib';
import {
  PDFFieldMapping,
  PrefillSource,
  FieldTransform,
  PDFFieldValue,
} from './pdf-types';

// ============================================================================
// DATA SOURCE TYPES
// ============================================================================

/**
 * User data available for prefill
 */
export interface UserPrefillData {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string | Date;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostcode?: string;
  addressCountry?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  taxFileNumber?: string;
  bankAccountName?: string;
  bankBSB?: string;
  bankAccountNumber?: string;
  superFundName?: string;
  superMemberNumber?: string;
}

/**
 * Venue data available for prefill
 */
export interface VenuePrefillData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Assignment data available for prefill
 */
export interface AssignmentPrefillData {
  assignedDate?: string | Date;
  dueDate?: string | Date;
}

/**
 * Combined prefill data context
 */
export interface PrefillDataContext {
  user?: UserPrefillData;
  venue?: VenuePrefillData;
  assignment?: AssignmentPrefillData;
  customValues?: Record<string, string>;
}

// ============================================================================
// TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Apply transformation to a value
 */
export function applyTransform(
  value: string | undefined,
  transform: FieldTransform
): string | undefined {
  if (!value) return value;
  
  switch (transform.type) {
    case 'uppercase':
      return value.toUpperCase();
      
    case 'lowercase':
      return value.toLowerCase();
      
    case 'capitalize':
      return value.replace(/\b\w/g, (char) => char.toUpperCase());
      
    case 'date_format':
      return formatDate(value, transform.config?.format as string);
      
    case 'phone_format':
      return formatPhone(value);
      
    default:
      return value;
  }
}

/**
 * Format a date string
 */
function formatDate(value: string, format?: string): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    switch (format) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      default:
        return `${day}/${month}/${year}`;
    }
  } catch {
    return value;
  }
}

/**
 * Format a phone number (Australian format)
 */
function formatPhone(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, '');
  
  // Australian mobile: 04XX XXX XXX
  if (digits.length === 10 && digits.startsWith('04')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  // Australian landline: 0X XXXX XXXX
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  
  // International format
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 9)} ${digits.slice(-9, -6)} ${digits.slice(-6, -3)} ${digits.slice(-3)}`;
  }
  
  // Default: just return with spaces
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)}${digits.length > 8 ? ' ' + digits.slice(8) : ''}`;
  }
  
  return value;
}

// ============================================================================
// PREFILL VALUE RESOLUTION
// ============================================================================

/**
 * Resolve a prefill source to a value
 */
export function resolvePrefillValue(
  source: PrefillSource,
  context: PrefillDataContext,
  customValue?: string
): string | undefined {
  // Handle custom value
  if (source === 'custom') {
    return customValue;
  }
  
  // Split source into category and field
  const [category, field] = source.split('.') as [string, string];
  
  switch (category) {
    case 'user':
      return resolveUserField(field, context.user);
      
    case 'venue':
      return resolveVenueField(field, context.venue);
      
    case 'assignment':
      return resolveAssignmentField(field, context.assignment);
      
    default:
      return undefined;
  }
}

/**
 * Resolve user field
 */
function resolveUserField(field: string, user?: UserPrefillData): string | undefined {
  if (!user) return undefined;
  
  switch (field) {
    case 'name':
      return user.name;
    case 'email':
      return user.email;
    case 'phone':
      return user.phone;
    case 'dateOfBirth':
      return user.dateOfBirth instanceof Date
        ? user.dateOfBirth.toISOString().split('T')[0]
        : user.dateOfBirth;
    case 'addressStreet':
      return user.addressStreet;
    case 'addressCity':
      return user.addressCity;
    case 'addressState':
      return user.addressState;
    case 'addressPostcode':
      return user.addressPostcode;
    case 'addressCountry':
      return user.addressCountry;
    case 'emergencyContactName':
      return user.emergencyContactName;
    case 'emergencyContactPhone':
      return user.emergencyContactPhone;
    case 'taxFileNumber':
      return user.taxFileNumber;
    case 'bankAccountName':
      return user.bankAccountName;
    case 'bankBSB':
      return user.bankBSB;
    case 'bankAccountNumber':
      return user.bankAccountNumber;
    case 'superFundName':
      return user.superFundName;
    case 'superMemberNumber':
      return user.superMemberNumber;
    default:
      return undefined;
  }
}

/**
 * Resolve venue field
 */
function resolveVenueField(field: string, venue?: VenuePrefillData): string | undefined {
  if (!venue) return undefined;
  
  switch (field) {
    case 'name':
      return venue.name;
    case 'address':
      return venue.address;
    case 'phone':
      return venue.phone;
    case 'email':
      return venue.email;
    default:
      return undefined;
  }
}

/**
 * Resolve assignment field
 */
function resolveAssignmentField(field: string, assignment?: AssignmentPrefillData): string | undefined {
  if (!assignment) return undefined;
  
  switch (field) {
    case 'assignedDate':
      return assignment.assignedDate instanceof Date
        ? assignment.assignedDate.toISOString().split('T')[0]
        : assignment.assignedDate;
    case 'dueDate':
      return assignment.dueDate instanceof Date
        ? assignment.dueDate.toISOString().split('T')[0]
        : assignment.dueDate;
    default:
      return undefined;
  }
}

// ============================================================================
// PREFILL PDF GENERATION
// ============================================================================

/**
 * Prefill result
 */
export interface PrefillResult {
  /** Field values that were resolved */
  fieldValues: PDFFieldValue[];
  /** Fields that couldn't be resolved */
  unresolvedFields: string[];
  /** Fields that had errors */
  errors: Array<{ fieldName: string; error: string }>;
}

/**
 * Generate prefill values from mappings
 */
export function generatePrefillValues(
  mappings: PDFFieldMapping[],
  context: PrefillDataContext
): PrefillResult {
  const fieldValues: PDFFieldValue[] = [];
  const unresolvedFields: string[] = [];
  const errors: Array<{ fieldName: string; error: string }> = [];
  
  for (const mapping of mappings) {
    if (!mapping.isActive || !mapping.prefillSource) {
      continue;
    }
    
    try {
      let value = resolvePrefillValue(
        mapping.prefillSource,
        context,
        mapping.customValue
      );
      
      // Apply transformation if configured
      if (value && mapping.transform) {
        value = applyTransform(value, mapping.transform);
      }
      
      if (value !== undefined) {
        fieldValues.push({
          fieldName: mapping.pdfFieldName,
          value,
          type: 'text', // Default type, will be determined by PDF field
        });
      } else {
        unresolvedFields.push(mapping.pdfFieldName);
      }
    } catch (error) {
      errors.push({
        fieldName: mapping.pdfFieldName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return {
    fieldValues,
    unresolvedFields,
    errors,
  };
}

/**
 * Prefill a PDF with resolved values
 */
export async function prefillPDF(
  pdfData: ArrayBuffer | Uint8Array,
  mappings: PDFFieldMapping[],
  context: PrefillDataContext
): Promise<{ pdfDoc: PDFDocument; result: PrefillResult }> {
  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  
  // Generate prefill values
  const result = generatePrefillValues(mappings, context);
  
  // Apply values to PDF fields
  for (const fieldValue of result.fieldValues) {
    try {
      const field = form.getField(fieldValue.fieldName);
      const fieldType = field.constructor.name;
      
      if (fieldType === 'PDFTextField') {
        const textField = form.getTextField(fieldValue.fieldName);
        textField.setText(String(fieldValue.value));
      } else if (fieldType === 'PDFCheckBox') {
        const checkbox = form.getCheckBox(fieldValue.fieldName);
        if (fieldValue.value === true || fieldValue.value === 'true' || fieldValue.value === 'Yes') {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
      } else if (fieldType === 'PDFDropdown') {
        const dropdown = form.getDropdown(fieldValue.fieldName);
        dropdown.select(String(fieldValue.value));
      } else if (fieldType === 'PDFRadioGroup') {
        const radioGroup = form.getRadioGroup(fieldValue.fieldName);
        radioGroup.select(String(fieldValue.value));
      }
    } catch (error) {
      result.errors.push({
        fieldName: fieldValue.fieldName,
        error: error instanceof Error ? error.message : 'Failed to set field value',
      });
    }
  }
  
  return { pdfDoc, result };
}

/**
 * Generate a pre-filled PDF as bytes
 */
export async function generatePrefilledPDF(
  pdfData: ArrayBuffer | Uint8Array,
  mappings: PDFFieldMapping[],
  context: PrefillDataContext
): Promise<Uint8Array> {
  const { pdfDoc } = await prefillPDF(pdfData, mappings, context);
  return pdfDoc.save();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all available prefill data fields
 */
export function getAvailablePrefillDataFields(): Array<{
  source: PrefillSource;
  displayName: string;
  category: string;
}> {
  return [
    // User fields
    { source: 'user.name', displayName: 'Full Name', category: 'User' },
    { source: 'user.email', displayName: 'Email Address', category: 'User' },
    { source: 'user.phone', displayName: 'Phone Number', category: 'User' },
    { source: 'user.dateOfBirth', displayName: 'Date of Birth', category: 'User' },
    { source: 'user.addressStreet', displayName: 'Street Address', category: 'User' },
    { source: 'user.addressCity', displayName: 'City', category: 'User' },
    { source: 'user.addressState', displayName: 'State/Province', category: 'User' },
    { source: 'user.addressPostcode', displayName: 'Postal Code', category: 'User' },
    { source: 'user.addressCountry', displayName: 'Country', category: 'User' },
    { source: 'user.emergencyContactName', displayName: 'Emergency Contact', category: 'User' },
    { source: 'user.emergencyContactPhone', displayName: 'Emergency Phone', category: 'User' },
    { source: 'user.taxFileNumber', displayName: 'Tax File Number', category: 'User' },
    { source: 'user.bankAccountName', displayName: 'Bank Account Name', category: 'User' },
    { source: 'user.bankBSB', displayName: 'Bank BSB', category: 'User' },
    { source: 'user.bankAccountNumber', displayName: 'Bank Account Number', category: 'User' },
    { source: 'user.superFundName', displayName: 'Super Fund Name', category: 'User' },
    { source: 'user.superMemberNumber', displayName: 'Super Member Number', category: 'User' },
    
    // Venue fields
    { source: 'venue.name', displayName: 'Venue Name', category: 'Venue' },
    { source: 'venue.address', displayName: 'Venue Address', category: 'Venue' },
    { source: 'venue.phone', displayName: 'Venue Phone', category: 'Venue' },
    { source: 'venue.email', displayName: 'Venue Email', category: 'Venue' },
    
    // Assignment fields
    { source: 'assignment.assignedDate', displayName: 'Assignment Date', category: 'Assignment' },
    { source: 'assignment.dueDate', displayName: 'Due Date', category: 'Assignment' },
    
    // Custom
    { source: 'custom', displayName: 'Custom Value', category: 'Custom' },
  ];
}

/**
 * Validate prefill data context
 */
export function validatePrefillContext(context: PrefillDataContext): {
  valid: boolean;
  missing: PrefillSource[];
} {
  const missing: PrefillSource[] = [];
  
  // Check if any user fields are needed
  if (context.user) {
    if (!context.user.name) missing.push('user.name');
    if (!context.user.email) missing.push('user.email');
    // Add more checks as needed
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}
