/**
 * Form Validation Engine
 * 
 * This module provides validation logic for form fields including:
 * - Required field validation
 * - Type-specific validation (email, phone, etc.)
 * - Custom pattern validation
 * - Min/max length validation
 * - Conditional logic evaluation
 */

import {
  FormSchema,
  FormField,
  FieldValidation,
  FieldError,
  FormData,
  ValidationType,
  ConditionalLogic,
  Condition,
  ConditionOperator,
  FieldType,
} from '@/lib/types/form-schema';

// ============================================================================
// VALIDATION REGEX PATTERNS
// ============================================================================

export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}$/,
  phoneInternational: /^\+?[1-9]\d{1,14}$/,
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  postcode: /^[0-9]{4}$/,
  postcodeNZ: /^[0-9]{4}$/,
  abn: /^\d{11}$/,
  tfn: /^\d{8,9}$/,
  bsb: /^\d{6}$/,
  accountNumber: /^\d{6,10}$/,
};

// ============================================================================
// DEFAULT VALIDATION MESSAGES
// ============================================================================

export const DEFAULT_MESSAGES = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  url: 'Please enter a valid URL',
  min: (value: number) => `Value must be at least ${value}`,
  max: (value: number) => `Value must be at most ${value}`,
  minLength: (value: number) => `Must be at least ${value} characters`,
  maxLength: (value: number) => `Must be at most ${value} characters`,
  pattern: 'Invalid format',
  date: 'Please enter a valid date',
  fileSize: (maxSize: number) => `File size must be less than ${formatFileSize(maxSize)}`,
  fileType: 'Invalid file type',
  custom: 'Invalid value',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a value is empty
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Get string length of a value
 */
function getLength(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.length;
  return 0;
}

// ============================================================================
// SINGLE FIELD VALIDATION
// ============================================================================

/**
 * Validate a single field value
 */
export function validateField(
  field: FormField,
  value: unknown,
  allData?: FormData
): FieldError | null {
  // Check conditional logic first
  if (field.conditionalLogic && allData) {
    const shouldValidate = evaluateConditionalLogic(field.conditionalLogic, allData);
    if (!shouldValidate) {
      return null; // Field is hidden/disabled, skip validation
    }
  }

  // Required validation
  if (field.required && isEmpty(value)) {
    return {
      fieldId: field.id,
      type: 'required',
      message: DEFAULT_MESSAGES.required,
    };
  }

  // Skip further validation if field is empty and not required
  if (isEmpty(value)) {
    return null;
  }

  // Type-specific validation
  const typeError = validateByType(field.type, value);
  if (typeError) {
    return typeError;
  }

  // Custom validation rules
  if (field.validation && field.validation.length > 0) {
    for (const rule of field.validation) {
      const error = validateRule(rule, value, field);
      if (error) {
        return error;
      }
    }
  }

  // Field-specific validation
  const fieldSpecificError = validateFieldSpecific(field, value);
  if (fieldSpecificError) {
    return fieldSpecificError;
  }

  return null;
}

/**
 * Validate by field type
 */
function validateByType(type: FieldType, value: unknown): FieldError | null {
  switch (type) {
    case 'email':
      if (typeof value === 'string' && !VALIDATION_PATTERNS.email.test(value)) {
        return {
          fieldId: '',
          type: 'email',
          message: DEFAULT_MESSAGES.email,
        };
      }
      break;

    case 'phone':
      if (typeof value === 'string') {
        const digits = value.replace(/\D/g, '');
        if (!VALIDATION_PATTERNS.phone.test(digits) && !VALIDATION_PATTERNS.phoneInternational.test(digits)) {
          return {
            fieldId: '',
            type: 'phone',
            message: DEFAULT_MESSAGES.phone,
          };
        }
      }
      break;

    case 'date':
    case 'datetime':
      if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return {
            fieldId: '',
            type: 'date',
            message: DEFAULT_MESSAGES.date,
          };
        }
      }
      break;
  }

  return null;
}

/**
 * Validate a single validation rule
 */
function validateRule(
  rule: FieldValidation,
  value: unknown,
  field: FormField
): FieldError | null {
  switch (rule.type) {
    case 'required':
      if (isEmpty(value)) {
        return {
          fieldId: field.id,
          type: 'required',
          message: rule.message || DEFAULT_MESSAGES.required,
        };
      }
      break;

    case 'min':
      if (typeof value === 'number' && rule.value !== undefined && typeof rule.value === 'number' && value < rule.value) {
        return {
          fieldId: field.id,
          type: 'min',
          message: rule.message || DEFAULT_MESSAGES.min(rule.value),
        };
      }
      break;

    case 'max':
      if (typeof value === 'number' && rule.value !== undefined && typeof rule.value === 'number' && value > rule.value) {
        return {
          fieldId: field.id,
          type: 'max',
          message: rule.message || DEFAULT_MESSAGES.max(rule.value),
        };
      }
      break;

    case 'minLength':
      if (rule.value !== undefined && typeof rule.value === 'number' && getLength(value) < rule.value) {
        return {
          fieldId: field.id,
          type: 'minLength',
          message: rule.message || DEFAULT_MESSAGES.minLength(rule.value),
        };
      }
      break;

    case 'maxLength':
      if (rule.value !== undefined && typeof rule.value === 'number' && getLength(value) > rule.value) {
        return {
          fieldId: field.id,
          type: 'maxLength',
          message: rule.message || DEFAULT_MESSAGES.maxLength(rule.value),
        };
      }
      break;

    case 'pattern':
      if (typeof value === 'string' && rule.value) {
        const regex = new RegExp(rule.value as string);
        if (!regex.test(value)) {
          return {
            fieldId: field.id,
            type: 'pattern',
            message: rule.message || DEFAULT_MESSAGES.pattern,
          };
        }
      }
      break;

    case 'email':
      if (typeof value === 'string' && !VALIDATION_PATTERNS.email.test(value)) {
        return {
          fieldId: field.id,
          type: 'email',
          message: rule.message || DEFAULT_MESSAGES.email,
        };
      }
      break;

    case 'phone':
      if (typeof value === 'string') {
        const digits = value.replace(/\D/g, '');
        if (!VALIDATION_PATTERNS.phone.test(digits)) {
          return {
            fieldId: field.id,
            type: 'phone',
            message: rule.message || DEFAULT_MESSAGES.phone,
          };
        }
      }
      break;

    case 'url':
      if (typeof value === 'string' && !VALIDATION_PATTERNS.url.test(value)) {
        return {
          fieldId: field.id,
          type: 'url',
          message: rule.message || DEFAULT_MESSAGES.url,
        };
      }
      break;

    case 'fileSize':
      // File size validation is handled separately
      break;

    case 'fileType':
      // File type validation is handled separately
      break;

    case 'custom':
      // Custom validation would need to be implemented per use case
      break;
  }

  return null;
}

/**
 * Field-specific validation (number ranges, file uploads, etc.)
 */
function validateFieldSpecific(field: FormField, value: unknown): FieldError | null {
  // Number field validation
  if (field.type === 'number' && typeof value === 'number') {
    if (field.min !== undefined && value < field.min) {
      return {
        fieldId: field.id,
        type: 'min',
        message: DEFAULT_MESSAGES.min(field.min),
      };
    }
    if (field.max !== undefined && value > field.max) {
      return {
        fieldId: field.id,
        type: 'max',
        message: DEFAULT_MESSAGES.max(field.max),
      };
    }
  }

  // Date field validation
  if ((field.type === 'date' || field.type === 'datetime') && typeof value === 'string') {
    const date = new Date(value);
    if (field.minDate && date < new Date(field.minDate)) {
      return {
        fieldId: field.id,
        type: 'min',
        message: `Date must be on or after ${new Date(field.minDate).toLocaleDateString()}`,
      };
    }
    if (field.maxDate && date > new Date(field.maxDate)) {
      return {
        fieldId: field.id,
        type: 'max',
        message: `Date must be on or before ${new Date(field.maxDate).toLocaleDateString()}`,
      };
    }
  }

  // File upload validation
  if ((field.type === 'file' || field.type === 'image') && value && typeof value === 'object') {
    const file = value as { size?: number; type?: string };
    const config = field.fileConfig;

    if (config?.maxSize && file.size && file.size > config.maxSize) {
      return {
        fieldId: field.id,
        type: 'fileSize',
        message: DEFAULT_MESSAGES.fileSize(config.maxSize),
      };
    }

    if (config?.accept && file.type) {
      const acceptedTypes = config.accept;
      const fileType = file.type;
      const isAccepted = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          // File extension check
          return fileType === type;
        }
        // MIME type check
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.slice(0, -1));
        }
        return fileType === type;
      });

      if (!isAccepted) {
        return {
          fieldId: field.id,
          type: 'fileType',
          message: DEFAULT_MESSAGES.fileType,
        };
      }
    }
  }

  return null;
}

// ============================================================================
// FORM-WIDE VALIDATION
// ============================================================================

/**
 * Validate all fields in a form
 */
export function validateForm(
  schema: FormSchema,
  data: FormData
): FieldError[] {
  const errors: FieldError[] = [];

  for (const field of schema.fields) {
    const value = data[field.id];
    const error = validateField(field, value, data);
    if (error) {
      error.fieldId = field.id;
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Check if form is valid
 */
export function isFormValid(
  schema: FormSchema,
  data: FormData
): boolean {
  return validateForm(schema, data).length === 0;
}

// ============================================================================
// CONDITIONAL LOGIC EVALUATION
// ============================================================================

/**
 * Evaluate conditional logic for a field
 */
export function evaluateConditionalLogic(
  logic: ConditionalLogic,
  data: FormData
): boolean {
  // Evaluate each condition group
  const groupResults = logic.conditionGroups.map((group) => {
    const conditionResults = group.conditions.map((condition) => {
      if ('fieldId' in condition) {
        // This is a single condition
        return evaluateCondition(condition as Condition, data);
      } else {
        // This is a nested condition group
        return evaluateConditionalLogic(condition as unknown as ConditionalLogic, data);
      }
    });

    if (group.operator === 'and') {
      return conditionResults.every(Boolean);
    } else {
      return conditionResults.some(Boolean);
    }
  });

  // For simplicity, if there are multiple condition groups, we'll use OR logic
  return groupResults.some(Boolean);
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition: Condition, data: FormData): boolean {
  const fieldValue = data[condition.fieldId];

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;

    case 'not_equals':
      return fieldValue !== condition.value;

    case 'contains':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.includes(condition.value);
      }
      if (Array.isArray(fieldValue) && condition.value !== undefined) {
        return fieldValue.some(item => item === condition.value);
      }
      return false;

    case 'not_contains':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return !fieldValue.includes(condition.value);
      }
      if (Array.isArray(fieldValue) && condition.value !== undefined) {
        return !fieldValue.some(item => item === condition.value);
      }
      return true;

    case 'greater_than':
      if (typeof fieldValue === 'number' && typeof condition.value === 'number') {
        return fieldValue > condition.value;
      }
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return new Date(fieldValue) > new Date(condition.value);
      }
      return false;

    case 'less_than':
      if (typeof fieldValue === 'number' && typeof condition.value === 'number') {
        return fieldValue < condition.value;
      }
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return new Date(fieldValue) < new Date(condition.value);
      }
      return false;

    case 'greater_than_or_equal':
      if (typeof fieldValue === 'number' && typeof condition.value === 'number') {
        return fieldValue >= condition.value;
      }
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return new Date(fieldValue) >= new Date(condition.value);
      }
      return false;

    case 'less_than_or_equal':
      if (typeof fieldValue === 'number' && typeof condition.value === 'number') {
        return fieldValue <= condition.value;
      }
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return new Date(fieldValue) <= new Date(condition.value);
      }
      return false;

    case 'is_empty':
      return isEmpty(fieldValue);

    case 'is_not_empty':
      return !isEmpty(fieldValue);

    default:
      return false;
  }
}

/**
 * Check if a field should be visible based on conditional logic
 */
export function shouldShowField(
  field: FormField,
  data: FormData
): boolean {
  if (!field.conditionalLogic) return true;

  const logic = field.conditionalLogic;
  
  if (logic.action === 'show') {
    return evaluateConditionalLogic(logic, data);
  }
  
  if (logic.action === 'hide') {
    return !evaluateConditionalLogic(logic, data);
  }

  return true;
}

/**
 * Check if a field should be required based on conditional logic
 */
export function shouldRequireField(
  field: FormField,
  data: FormData
): boolean {
  if (!field.conditionalLogic) return field.required;

  const logic = field.conditionalLogic;
  
  if (logic.action === 'require') {
    return evaluateConditionalLogic(logic, data);
  }

  return field.required;
}

/**
 * Check if a field should be disabled based on conditional logic
 */
export function shouldDisableField(
  field: FormField,
  data: FormData
): boolean {
  if (!field.conditionalLogic) return false;

  const logic = field.conditionalLogic;
  
  if (logic.action === 'disable') {
    return evaluateConditionalLogic(logic, data);
  }

  return false;
}

// ============================================================================
// VALIDATION HELPER HOOKS
// ============================================================================

/**
 * Create validation rules for a field
 */
export function createValidationRules(field: FormField): FieldValidation[] {
  const rules: FieldValidation[] = [];

  if (field.required) {
    rules.push({
      type: 'required',
      message: DEFAULT_MESSAGES.required,
    });
  }

  // Add type-specific validation
  switch (field.type) {
    case 'email':
      rules.push({
        type: 'email',
        message: DEFAULT_MESSAGES.email,
      });
      break;
    case 'phone':
      rules.push({
        type: 'phone',
        message: DEFAULT_MESSAGES.phone,
      });
      break;
  }

  // Add field-specific validation
  if (field.type === 'number') {
    if (field.min !== undefined) {
      rules.push({
        type: 'min',
        value: field.min,
        message: DEFAULT_MESSAGES.min(field.min),
      });
    }
    if (field.max !== undefined) {
      rules.push({
        type: 'max',
        value: field.max,
        message: DEFAULT_MESSAGES.max(field.max),
      });
    }
  }

  // Add custom validation
  if (field.validation) {
    rules.push(...field.validation);
  }

  return rules;
}

/**
 * Get visible fields based on conditional logic
 */
export function getVisibleFields(
  schema: FormSchema,
  data: FormData
): FormField[] {
  return schema.fields.filter((field) => shouldShowField(field, data));
}

/**
 * Get required fields based on conditional logic
 */
export function getRequiredFields(
  schema: FormSchema,
  data: FormData
): FormField[] {
  return schema.fields.filter((field) => shouldRequireField(field, data));
}
