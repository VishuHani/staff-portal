/**
 * Shared types for form field components
 */

import { FormField, FieldError } from '@/lib/types/form-schema';

/**
 * Props common to all field components (for rendering)
 */
export interface BaseFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  error?: FieldError;
  disabled?: boolean;
  readOnly?: boolean;
}

/**
 * Props for field components in builder mode
 */
export interface BuilderFieldProps {
  field: FormField;
  isSelected?: boolean;
  onSelect?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

/**
 * Props for field configuration panel
 */
export interface FieldConfigProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  allFields: FormField[];
}
