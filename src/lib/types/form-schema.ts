/**
 * Form Schema Types for Document Management System
 * 
 * This module defines the TypeScript types for the dynamic form builder
 * used in document templates and submissions.
 */

// ============================================================================
// FIELD TYPE DEFINITIONS
// ============================================================================

/**
 * All supported field types in the form builder
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'file'
  | 'image'
  | 'signature'
  | 'divider'
  | 'header'
  | 'paragraph'
  // New advanced field types
  | 'rating'      // Star/emoji rating (1-5, 1-10)
  | 'scale'       // Numeric scale (NPS, satisfaction)
  | 'slider'      // Range slider with min/max
  | 'calculation' // Computed value from formula
  | 'currency'    // Currency with formatting
  | 'percentage'  // Percentage input
  | 'url'         // URL with validation
  | 'matrix'      // Grid/Likert scale
  // Phase 6: Advanced structure field types
  | 'repeating_section' // Dynamic repeating field groups
  | 'page_break';       // Multi-page form separator

/**
 * Categories for grouping field types in the builder palette
 */
export type FieldCategory = 'input' | 'choice' | 'upload' | 'layout' | 'advanced';

/**
 * Field type metadata for the builder UI
 */
export interface FieldTypeConfig {
  type: FieldType;
  label: string;
  icon: string;
  category: FieldCategory;
  description: string;
  defaultValue?: unknown;
  supportsValidation: boolean;
  supportsOptions: boolean;
  supportsConditional: boolean;
}

/**
 * Predefined field type configurations
 */
export const FIELD_TYPE_CONFIGS: Record<FieldType, FieldTypeConfig> = {
  text: {
    type: 'text',
    label: 'Text Input',
    icon: 'Type',
    category: 'input',
    description: 'Single-line text input',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  textarea: {
    type: 'textarea',
    label: 'Text Area',
    icon: 'AlignLeft',
    category: 'input',
    description: 'Multi-line text input',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  number: {
    type: 'number',
    label: 'Number',
    icon: 'Hash',
    category: 'input',
    description: 'Numeric input with min/max',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  email: {
    type: 'email',
    label: 'Email',
    icon: 'Mail',
    category: 'input',
    description: 'Email input with validation',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  phone: {
    type: 'phone',
    label: 'Phone',
    icon: 'Phone',
    category: 'input',
    description: 'Phone number with formatting',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  date: {
    type: 'date',
    label: 'Date',
    icon: 'Calendar',
    category: 'input',
    description: 'Date picker',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  time: {
    type: 'time',
    label: 'Time',
    icon: 'Clock',
    category: 'input',
    description: 'Time picker',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  datetime: {
    type: 'datetime',
    label: 'Date & Time',
    icon: 'CalendarClock',
    category: 'input',
    description: 'Combined date and time picker',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  select: {
    type: 'select',
    label: 'Dropdown',
    icon: 'ChevronDown',
    category: 'choice',
    description: 'Single-select dropdown',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: true,
    supportsConditional: true,
  },
  multiselect: {
    type: 'multiselect',
    label: 'Multi-Select',
    icon: 'List',
    category: 'choice',
    description: 'Multi-select dropdown',
    defaultValue: [],
    supportsValidation: true,
    supportsOptions: true,
    supportsConditional: true,
  },
  radio: {
    type: 'radio',
    label: 'Radio Buttons',
    icon: 'CircleDot',
    category: 'choice',
    description: 'Radio button group',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: true,
    supportsConditional: true,
  },
  checkbox: {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'CheckSquare',
    category: 'choice',
    description: 'Single checkbox',
    defaultValue: false,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  toggle: {
    type: 'toggle',
    label: 'Toggle Switch',
    icon: 'ToggleLeft',
    category: 'choice',
    description: 'Toggle switch for yes/no',
    defaultValue: false,
    supportsValidation: false,
    supportsOptions: false,
    supportsConditional: true,
  },
  file: {
    type: 'file',
    label: 'File Upload',
    icon: 'Upload',
    category: 'upload',
    description: 'File upload field',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  image: {
    type: 'image',
    label: 'Image Upload',
    icon: 'Image',
    category: 'upload',
    description: 'Image upload with preview',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  signature: {
    type: 'signature',
    label: 'Signature',
    icon: 'PenTool',
    category: 'upload',
    description: 'Signature capture (Phase 5)',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    icon: 'Minus',
    category: 'layout',
    description: 'Visual divider line',
    defaultValue: undefined,
    supportsValidation: false,
    supportsOptions: false,
    supportsConditional: false,
  },
  header: {
    type: 'header',
    label: 'Section Header',
    icon: 'Heading',
    category: 'layout',
    description: 'Section header text',
    defaultValue: '',
    supportsValidation: false,
    supportsOptions: false,
    supportsConditional: false,
  },
  paragraph: {
    type: 'paragraph',
    label: 'Paragraph',
    icon: 'FileText',
    category: 'layout',
    description: 'Informational text block',
    defaultValue: '',
    supportsValidation: false,
    supportsOptions: false,
    supportsConditional: false,
  },
  // New advanced field types
  rating: {
    type: 'rating',
    label: 'Rating',
    icon: 'Star',
    category: 'advanced',
    description: 'Star or emoji rating scale',
    defaultValue: 0,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  scale: {
    type: 'scale',
    label: 'Scale (NPS)',
    icon: 'Gauge',
    category: 'advanced',
    description: 'Numeric scale for satisfaction/NPS',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  slider: {
    type: 'slider',
    label: 'Slider',
    icon: 'Sliders',
    category: 'advanced',
    description: 'Range slider with min/max',
    defaultValue: 0,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  calculation: {
    type: 'calculation',
    label: 'Calculation',
    icon: 'Calculator',
    category: 'advanced',
    description: 'Computed value from formula',
    defaultValue: 0,
    supportsValidation: false,
    supportsOptions: false,
    supportsConditional: true,
  },
  currency: {
    type: 'currency',
    label: 'Currency',
    icon: 'DollarSign',
    category: 'advanced',
    description: 'Currency input with formatting',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  percentage: {
    type: 'percentage',
    label: 'Percentage',
    icon: 'Percent',
    category: 'advanced',
    description: 'Percentage input (0-100)',
    defaultValue: null,
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  url: {
    type: 'url',
    label: 'URL',
    icon: 'Link',
    category: 'advanced',
    description: 'URL input with validation',
    defaultValue: '',
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  matrix: {
    type: 'matrix',
    label: 'Matrix/Grid',
    icon: 'Grid',
    category: 'advanced',
    description: 'Grid/Likert scale matrix',
    defaultValue: {},
    supportsValidation: true,
    supportsOptions: true,
    supportsConditional: true,
  },
  // Phase 6: Advanced structure field types
  repeating_section: {
    type: 'repeating_section',
    label: 'Repeating Section',
    icon: 'Copy',
    category: 'layout',
    description: 'Dynamic repeating field groups',
    defaultValue: [],
    supportsValidation: true,
    supportsOptions: false,
    supportsConditional: true,
  },
  page_break: {
    type: 'page_break',
    label: 'Page Break',
    icon: 'FileText',
    category: 'layout',
    description: 'Multi-page form separator',
    defaultValue: undefined,
    supportsValidation: false,
    supportsOptions: false,
    supportsConditional: true,
  },
};

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Types of validation rules
 */
export type ValidationType =
  | 'required'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'email'
  | 'url'
  | 'phone'
  | 'date'
  | 'fileSize'
  | 'fileType'
  | 'custom';

/**
 * Single validation rule
 */
export interface FieldValidation {
  type: ValidationType;
  value?: unknown;
  message: string;
}

/**
 * Validation rules grouped by field
 */
export type FieldValidations = FieldValidation[];

// ============================================================================
// CONDITIONAL LOGIC TYPES
// ============================================================================

/**
 * Operators for conditional logic conditions
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  // New operators
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'is_between'
  | 'is_one_of'
  | 'is_not_one_of'
  | 'has_any_of'
  | 'has_all_of'
  | 'has_none_of'
  | 'is_before'
  | 'is_after'
  | 'is_date_between'
  | 'is_today'
  | 'is_in_past'
  | 'is_in_future'
  | 'length_equals'
  | 'length_greater'
  | 'length_less';

/**
 * Actions that can be triggered by conditional logic
 */
export type ConditionalAction = 
  | 'show' 
  | 'hide' 
  | 'require' 
  | 'disable'
  // New actions
  | 'set_value'
  | 'clear_value'
  | 'set_options'
  | 'set_default'
  | 'set_min'
  | 'set_max'
  | 'skip_to'
  | 'end_form'
  | 'show_message';

/**
 * Logical operator for combining multiple conditions
 */
export type ConditionOperatorType = 'and' | 'or';

/**
 * Single condition in conditional logic
 */
export interface Condition {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: unknown;
  valueEnd?: unknown; // For "between" operators
}

/**
 * Condition group for nested logic
 */
export interface ConditionGroup {
  id: string;
  operator: ConditionOperatorType;
  conditions: (Condition | ConditionGroup)[];
}

/**
 * Conditional logic configuration for a field
 */
export interface ConditionalLogic {
  id: string;
  action: ConditionalAction;
  conditionGroups: ConditionGroup[];
  elseAction?: ConditionalAction;
  // For set_value action
  valueToSet?: unknown;
  // For show_message action
  message?: string;
  // For skip_to action
  targetFieldId?: string;
}

// ============================================================================
// SELECT OPTIONS TYPES
// ============================================================================

/**
 * Option for select, radio, and multiselect fields
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// ============================================================================
// FIELD APPEARANCE TYPES
// ============================================================================

/**
 * Field appearance configuration
 */
export interface FieldAppearance {
  width?: 'full' | 'half' | 'third' | 'quarter';
  labelPosition?: 'top' | 'left' | 'hidden';
  placeholder?: string;
  helpText?: string;
  description?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'large';
}

// ============================================================================
// FILE UPLOAD TYPES
// ============================================================================

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  accept?: string[];
  maxSize?: number; // in bytes
  maxFiles?: number;
  multiple?: boolean;
}

/**
 * Uploaded file metadata
 */
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: Date;
}

// ============================================================================
// MAIN FIELD TYPE
// ============================================================================

/**
 * Complete form field definition
 */
export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  description?: string;
  helpText?: string;
  required: boolean;
  validation?: FieldValidations;
  defaultValue?: unknown;
  options?: SelectOption[];
  conditionalLogic?: ConditionalLogic;
  appearance?: FieldAppearance;
  fileConfig?: FileUploadConfig;
  
  // Layout-specific fields
  headerLevel?: 1 | 2 | 3 | 4 | 5 | 6; // For header type
  content?: string; // For paragraph type
  
  // Number field specific
  min?: number;
  max?: number;
  step?: number;
  
  // Date/time field specific
  minDate?: string;
  maxDate?: string;
  format?: string;
  
  // Rating field specific
  ratingMax?: number; // Max rating value (default 5)
  ratingStyle?: 'stars' | 'numbers' | 'emojis' | 'hearts';
  ratingLabels?: { low: string; high: string }; // Endpoint labels
  
  // Scale field specific (NPS, satisfaction)
  scaleMin?: number; // Default 1
  scaleMax?: number; // Default 10 or 5
  scaleMinLabel?: string; // e.g., "Not likely"
  scaleMaxLabel?: string; // e.g., "Very likely"
  scaleStyle?: 'numbers' | 'faces' | 'gradient';
  
  // Slider field specific
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderUnit?: string; // e.g., "$", "%", "km"
  showSliderValue?: boolean;
  
  // Calculation field specific
  formula?: string; // e.g., "{field_1} * {field_2}"
  displayFormat?: 'number' | 'currency' | 'percentage';
  decimalPlaces?: number;
  currencySymbol?: string; // e.g., "$", "€"
  
  // Currency field specific
  currencyCode?: string; // e.g., "AUD", "USD"
  
  // Matrix field specific
  matrixRows?: SelectOption[]; // Row labels
  matrixColumns?: SelectOption[]; // Column labels
  matrixType?: 'radio' | 'checkbox'; // Single or multiple selection per row
  
  // Phase 6: Repeating section specific
  repeatingFields?: FormField[]; // Fields within each repeating item
  minItems?: number; // Minimum number of items
  maxItems?: number; // Maximum number of items
  addButtonText?: string; // Custom "Add" button text
  removeButtonText?: string; // Custom "Remove" button text
  showItemNumbers?: boolean; // Show item numbers (1, 2, 3...)
  
  // Phase 6: Page break specific
  pageTitle?: string; // Title for the next page
  pageDescription?: string; // Description for the next page
}

// ============================================================================
// FORM SETTINGS TYPES
// ============================================================================

/**
 * Form layout options
 */
export type FormLayout = 'single' | 'multiStep' | 'accordion';

/**
 * Form submission behavior
 */
export interface FormSubmissionConfig {
  submitLabel?: string;
  clearOnSubmit?: boolean;
  confirmMessage?: string;
  requireConfirmation?: boolean;
}

/**
 * Form settings configuration
 */
export interface FormSettings {
  layout: FormLayout;
  showProgress?: boolean;
  allowSave?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number; // milliseconds
  submission?: FormSubmissionConfig;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    borderColor?: string;
  };
  // Phase 6: Multi-page settings
  multiPage?: MultiPageSettings;
  // Phase 6: Save & resume settings
  saveResume?: SaveResumeConfig;
}

// ============================================================================
// PHASE 6: MULTI-PAGE FORM TYPES
// ============================================================================

/**
 * Multi-page form settings
 */
export interface MultiPageSettings {
  showProgressBar: boolean;
  progressPosition: 'top' | 'bottom' | 'left' | 'right';
  progressStyle: 'dots' | 'bar' | 'steps';
  allowJump: boolean; // Allow jumping between pages
  allowBackNavigation: boolean;
  saveOnPageChange: boolean;
  confirmBeforeLeave: boolean; // Show confirmation when leaving with unsaved changes
}

/**
 * Form page definition for multi-page forms
 */
export interface FormPage {
  id: string;
  title: string;
  description?: string;
  fields: FormField[]; // Field IDs or actual fields
  conditionalLogic?: ConditionalLogic; // Skip page logic
  showInNavigation?: boolean;
}

// ============================================================================
// PHASE 6: SAVE & RESUME TYPES
// ============================================================================

/**
 * Save & resume configuration
 */
export interface SaveResumeConfig {
  enabled: boolean;
  method: 'email' | 'link' | 'account';
  expirationDays?: number; // Days until saved form expires
  reminderEmails?: boolean; // Send reminder emails
  reminderInterval?: number; // Days between reminders
  maxResumes?: number; // Maximum number of saved drafts per user
}

/**
 * Saved form progress
 */
export interface SavedFormProgress {
  id: string;
  formId: string;
  userId?: string;
  email?: string;
  data: FormData;
  currentPage?: number;
  expiresAt: Date;
  resumeUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// PHASE 6: COLLABORATION TYPES
// ============================================================================

/**
 * Form collaboration settings
 */
export interface FormCollaboration {
  enabled: boolean;
  collaborators: FormCollaborator[];
  comments: FormComment[];
  versions: FormVersion[];
  allowComments: boolean;
  allowVersionHistory: boolean;
  maxVersions?: number; // Maximum versions to keep
}

/**
 * Collaborator on a form
 */
export interface FormCollaborator {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  lastActive: Date;
  invitedBy?: string;
  invitedAt?: Date;
}

/**
 * Comment on a form
 */
export interface FormComment {
  id: string;
  fieldId?: string; // Optional - comment on specific field
  userId: string;
  userName: string;
  message: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  replies?: FormCommentReply[];
}

/**
 * Reply to a comment
 */
export interface FormCommentReply {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Date;
}

/**
 * Form version for history
 */
export interface FormVersion {
  id: string;
  version: number;
  schema: FormSchema;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  changeDescription?: string;
  isPublished?: boolean;
}

// ============================================================================
// FORM METADATA TYPES
// ============================================================================

/**
 * Form metadata for tracking and auditing
 */
export interface FormMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  templateId?: string;
}

// ============================================================================
// MAIN FORM SCHEMA TYPE
// ============================================================================

/**
 * Complete form schema definition
 */
export interface FormSchema {
  id: string;
  version: number;
  name: string;
  description?: string;
  fields: FormField[];
  settings: FormSettings;
  metadata?: FormMetadata;
}

// ============================================================================
// FORM DATA TYPES (for submissions)
// ============================================================================

/**
 * Field value types based on field type
 */
export type FieldValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | UploadedFile
  | UploadedFile[]
  | null
  | undefined;

/**
 * Form data structure for submissions
 */
export type FormData = Record<string, FieldValue>;

// ============================================================================
// FORM STATE TYPES
// ============================================================================

/**
 * Validation error for a field
 */
export interface FieldError {
  fieldId: string;
  message: string;
  type: ValidationType;
}

/**
 * Form state during editing
 */
export interface FormState {
  data: FormData;
  errors: FieldError[];
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  currentStep?: number;
}

// ============================================================================
// BUILDER TYPES
// ============================================================================

/**
 * Field being edited in the builder
 */
export interface BuilderFieldState {
  field: FormField;
  isSelected: boolean;
  isDragging: boolean;
}

/**
 * Builder state
 */
export interface FormBuilderState {
  schema: FormSchema;
  selectedFieldId: string | null;
  draggedFieldId: string | null;
  isPreviewMode: boolean;
  zoom: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Create a new field with defaults
 */
export function createNewField(type: FieldType, index: number): FormField {
  const config = FIELD_TYPE_CONFIGS[type];
  
  const base: FormField = {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    label: config.label,
    required: false,
    defaultValue: config.defaultValue,
    validation: [],
    appearance: {
      width: 'full',
      labelPosition: 'top',
    },
  };
  
  // Add options for fields that support them
  if (config.supportsOptions) {
    base.options = [];
  }
  
  // Type-specific defaults
  switch (type) {
    case 'number':
      return { ...base, step: 1 };
    case 'header':
      return { ...base, headerLevel: 2 };
    case 'paragraph':
      return { ...base, content: '' };
    case 'rating':
      return {
        ...base,
        ratingMax: 5,
        ratingStyle: 'stars',
        ratingLabels: { low: 'Poor', high: 'Excellent' },
      };
    case 'scale':
      return {
        ...base,
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: 'Not likely',
        scaleMaxLabel: 'Very likely',
        scaleStyle: 'numbers',
      };
    case 'slider':
      return {
        ...base,
        sliderMin: 0,
        sliderMax: 100,
        sliderStep: 1,
        showSliderValue: true,
      };
    case 'calculation':
      return {
        ...base,
        formula: '',
        displayFormat: 'number',
        decimalPlaces: 2,
      };
    case 'currency':
      return {
        ...base,
        currencyCode: 'AUD',
        min: 0,
        step: 0.01,
      };
    case 'percentage':
      return {
        ...base,
        min: 0,
        max: 100,
        step: 1,
      };
    case 'matrix':
      return {
        ...base,
        matrixRows: [],
        matrixColumns: [],
        matrixType: 'radio',
        options: [],
      };
    case 'repeating_section':
      return {
        ...base,
        repeatingFields: [],
        minItems: 0,
        maxItems: 10,
        addButtonText: 'Add Item',
        removeButtonText: 'Remove',
        showItemNumbers: true,
      };
    case 'page_break':
      return {
        ...base,
        pageTitle: 'New Page',
        pageDescription: '',
      };
    default:
      return base;
  }
}

/**
 * Create a new form schema with defaults
 */
export function createNewSchema(name: string = 'Untitled Form'): FormSchema {
  return {
    id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: 1,
    name,
    fields: [],
    settings: {
      layout: 'single',
      showProgress: true,
      allowSave: true,
      autoSave: true,
      autoSaveInterval: 30000,
      submission: {
        submitLabel: 'Submit',
        clearOnSubmit: false,
        requireConfirmation: true,
        confirmMessage: 'Are you sure you want to submit this form?',
      },
    },
  };
}

/**
 * Get field type configuration
 */
export function getFieldConfig(type: FieldType): FieldTypeConfig {
  return FIELD_TYPE_CONFIGS[type];
}

/**
 * Check if a field type supports options
 */
export function fieldSupportsOptions(type: FieldType): boolean {
  return FIELD_TYPE_CONFIGS[type].supportsOptions;
}

/**
 * Check if a field type supports validation
 */
export function fieldSupportsValidation(type: FieldType): boolean {
  return FIELD_TYPE_CONFIGS[type].supportsValidation;
}

/**
 * Check if a field type supports conditional logic
 */
export function fieldSupportsConditional(type: FieldType): boolean {
  return FIELD_TYPE_CONFIGS[type].supportsConditional;
}

/**
 * Check if a field is a layout field (non-input)
 */
export function isLayoutField(type: FieldType): boolean {
  return FIELD_TYPE_CONFIGS[type].category === 'layout';
}

/**
 * Get all field types by category
 */
export function getFieldTypesByCategory(category: FieldCategory): FieldType[] {
  return Object.values(FIELD_TYPE_CONFIGS)
    .filter(config => config.category === category)
    .map(config => config.type);
}

/**
 * Validate a form schema structure
 */
export function validateSchema(schema: unknown): schema is FormSchema {
  if (typeof schema !== 'object' || schema === null) return false;
  
  const s = schema as Record<string, unknown>;
  
  return (
    typeof s.id === 'string' &&
    typeof s.version === 'number' &&
    typeof s.name === 'string' &&
    Array.isArray(s.fields) &&
    typeof s.settings === 'object'
  );
}
