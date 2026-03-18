/**
 * AI Form Builder Types
 * 
 * Types for AI-powered form building features including
 * field suggestions, form generation, and smart validation.
 */

import { FormField, FieldType, FormSchema } from './form-schema';

// ============================================================================
// AI FIELD SUGGESTIONS
// ============================================================================

/**
 * Suggestion for the next field to add to a form
 */
export interface AIFieldSuggestion {
  /** The suggested field */
  field: FormField;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for the suggestion */
  reason: string;
  /** Alternative field suggestions */
  alternatives?: FormField[];
  /** Category of suggestion */
  category: 'required' | 'recommended' | 'optional' | 'contextual';
}

/**
 * Context for AI field suggestions
 */
export interface AIFieldSuggestionContext {
  /** Existing fields in the form */
  currentFields: FormField[];
  /** Form name/title */
  formName?: string;
  /** Form description */
  formDescription?: string;
  /** Industry context */
  industry?: string;
  /** Form purpose/type */
  formType?: FormTypeHint;
  /** Target audience */
  audience?: AudienceHint;
}

/**
 * Form type hints for AI
 */
export type FormTypeHint =
  | 'registration'
  | 'feedback'
  | 'survey'
  | 'application'
  | 'contact'
  | 'order'
  | 'booking'
  | 'assessment'
  | 'compliance'
  | 'onboarding'
  | 'incident_report'
  | 'time_sheet'
  | 'leave_request'
  | 'expense_claim'
  | 'performance_review'
  | 'training_feedback'
  | 'safety_checklist'
  | 'inspection'
  | 'audit'
  | 'custom';

/**
 * Target audience hints
 */
export type AudienceHint =
  | 'employees'
  | 'customers'
  | 'vendors'
  | 'public'
  | 'internal_staff'
  | 'management'
  | 'contractors'
  | 'students'
  | 'patients'
  | 'custom';

// ============================================================================
// AI FORM GENERATION
// ============================================================================

/**
 * Options for AI form generation
 */
export interface AIFormGenerationOptions {
  /** Form name */
  name?: string;
  /** Form description */
  description?: string;
  /** Industry context */
  industry?: string;
  /** Compliance requirements */
  compliance?: ('GDPR' | 'HIPAA' | 'Australian Privacy' | 'SOC2')[];
  /** Include signature field */
  includeSignature?: boolean;
  /** Include consent fields */
  includeConsent?: boolean;
  /** Target number of fields */
  targetFieldCount?: number;
  /** Form type hint */
  formType?: FormTypeHint;
  /** Language for the form */
  language?: string;
  /** Model to use */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
}

/**
 * Result of AI form generation
 */
export interface AIFormGenerationResult {
  /** Generated form schema */
  schema: FormSchema;
  /** Generation metadata */
  metadata: {
    /** AI model used */
    model: string;
    /** Generation timestamp */
    generatedAt: string;
    /** Confidence score */
    confidence: number;
    /** Whether AI was used */
    aiGenerated: boolean;
    /** Number of fields generated */
    fieldCount: number;
    /** Processing time in ms */
    processingTime: number;
  };
  /** Suggestions for improvement */
  suggestions?: AIFieldSuggestion[];
  /** Warnings or notes */
  warnings?: string[];
  /** Missing recommended fields */
  missingFields?: string[];
}

// ============================================================================
// SMART VALIDATION
// ============================================================================

/**
 * Smart validation suggestion
 */
export interface SmartValidationSuggestion {
  /** Field ID */
  fieldId: string;
  /** Validation type */
  validationType: string;
  /** AI-generated error message */
  aiMessage: string;
  /** Suggested corrections */
  suggestions: string[];
  /** Context for the validation */
  context?: string;
}

/**
 * Validation analysis result
 */
export interface ValidationAnalysisResult {
  /** Overall form validation score (0-100) */
  score: number;
  /** Field-level analysis */
  fieldAnalysis: Array<{
    fieldId: string;
    fieldLabel: string;
    issues: ValidationIssue[];
    suggestions: string[];
  }>;
  /** Missing validations */
  missingValidations: Array<{
    fieldId: string;
    fieldLabel: string;
    recommendedValidations: string[];
  }>;
  /** Overall recommendations */
  recommendations: string[];
}

/**
 * Validation issue detected by AI
 */
export interface ValidationIssue {
  type: 'missing' | 'weak' | 'incorrect' | 'redundant';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

// ============================================================================
// FORM ANALYSIS
// ============================================================================

/**
 * AI analysis of a form
 */
export interface AIFormAnalysis {
  /** Form completeness score (0-100) */
  completenessScore: number;
  /** User experience score (0-100) */
  uxScore: number;
  /** Accessibility score (0-100) */
  accessibilityScore: number;
  /** Estimated completion time in minutes */
  estimatedCompletionTime: number;
  /** Detected form type */
  detectedType: FormTypeHint;
  /** Detected audience */
  detectedAudience: AudienceHint;
  /** Issues found */
  issues: FormIssue[];
  /** Recommendations */
  recommendations: FormRecommendation[];
  /** Field-level insights */
  fieldInsights: FieldInsight[];
}

/**
 * Issue found in a form
 */
export interface FormIssue {
  type: 'missing_field' | 'poor_labeling' | 'missing_validation' | 'accessibility' | 'ux' | 'logic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  fieldId?: string;
  description: string;
  suggestion: string;
}

/**
 * Recommendation for form improvement
 */
export interface FormRecommendation {
  priority: 'low' | 'medium' | 'high';
  category: 'fields' | 'validation' | 'logic' | 'ux' | 'accessibility';
  title: string;
  description: string;
  impact: string;
  implementation?: string;
}

/**
 * AI insight about a specific field
 */
export interface FieldInsight {
  fieldId: string;
  fieldLabel: string;
  /** Suggested improvements */
  improvements: string[];
  /** Common issues users might face */
  potentialIssues: string[];
  /** Suggested help text */
  suggestedHelpText?: string;
  /** Suggested placeholder */
  suggestedPlaceholder?: string;
}

// ============================================================================
// FORM TEMPLATES
// ============================================================================

/**
 * AI-generated form template
 */
export interface AIFormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  schema: FormSchema;
  usageCount: number;
  rating: number;
  industry?: string;
  compliance?: string[];
}

/**
 * Template search options
 */
export interface TemplateSearchOptions {
  query?: string;
  category?: string;
  industry?: string;
  formType?: FormTypeHint;
  compliance?: string[];
  tags?: string[];
  minRating?: number;
  sortBy?: 'relevance' | 'popularity' | 'rating' | 'recent';
}

// ============================================================================
// AI SERVICE CONFIG
// ============================================================================

/**
 * Configuration for AI form services
 */
export interface AIFormServiceConfig {
  /** OpenAI model to use */
  model: string;
  /** Maximum tokens for responses */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Enable caching */
  enableCache: boolean;
  /** Cache TTL in seconds */
  cacheTTL: number;
  /** Request timeout in ms */
  timeout: number;
  /** Retry attempts */
  retryAttempts: number;
}

/**
 * Default AI form service configuration
 */
export const DEFAULT_AI_FORM_CONFIG: AIFormServiceConfig = {
  model: 'gpt-4-turbo-preview',
  maxTokens: 2000,
  temperature: 0.7,
  enableCache: true,
  cacheTTL: 3600, // 1 hour
  timeout: 30000, // 30 seconds
  retryAttempts: 2,
};

// ============================================================================
// FIELD TYPE MAPPINGS
// ============================================================================

/**
 * Mapping of common field patterns to field types
 */
export const FIELD_TYPE_PATTERNS: Record<string, FieldType> = {
  // Personal information
  'name': 'text',
  'first name': 'text',
  'last name': 'text',
  'full name': 'text',
  'email': 'email',
  'phone': 'phone',
  'mobile': 'phone',
  'address': 'text',
  'street': 'text',
  'city': 'text',
  'state': 'select',
  'country': 'select',
  'postcode': 'text',
  'zip': 'text',
  'postal': 'text',
  
  // Dates and times
  'date': 'date',
  'date of birth': 'date',
  'dob': 'date',
  'birthday': 'date',
  'start date': 'date',
  'end date': 'date',
  'time': 'time',
  'datetime': 'datetime',
  
  // Numbers
  'age': 'number',
  'quantity': 'number',
  'amount': 'currency',
  'price': 'currency',
  'cost': 'currency',
  'total': 'calculation',
  'count': 'number',
  'percentage': 'percentage',
  'rate': 'rating',
  'rating': 'rating',
  'score': 'scale',
  
  // Text
  'description': 'textarea',
  'comments': 'textarea',
  'notes': 'textarea',
  'message': 'textarea',
  'feedback': 'textarea',
  'explanation': 'textarea',
  'reason': 'textarea',
  
  // Choices
  'gender': 'select',
  'title': 'select',
  'department': 'select',
  'category': 'select',
  'type': 'select',
  'status': 'select',
  'priority': 'select',
  'yes/no': 'toggle',
  'agree': 'checkbox',
  'consent': 'checkbox',
  'terms': 'checkbox',
  
  // Files
  'attachment': 'file',
  'document': 'file',
  'photo': 'image',
  'image': 'image',
  'signature': 'signature',
  'logo': 'image',
  
  // Web
  'website': 'url',
  'url': 'url',
  'link': 'url',
};

/**
 * Common field groups for suggestions
 */
export const FIELD_GROUPS: Record<string, FormField[]> = {
  personalInfo: [
    { id: 'first_name', type: 'text', label: 'First Name', required: true },
    { id: 'last_name', type: 'text', label: 'Last Name', required: true },
    { id: 'email', type: 'email', label: 'Email Address', required: true },
    { id: 'phone', type: 'phone', label: 'Phone Number', required: false },
  ],
  address: [
    { id: 'street_address', type: 'text', label: 'Street Address', required: true },
    { id: 'city', type: 'text', label: 'City', required: true },
    { id: 'state', type: 'select', label: 'State', required: true },
    { id: 'postcode', type: 'text', label: 'Postcode', required: true },
    { id: 'country', type: 'select', label: 'Country', required: true },
  ],
  emergencyContact: [
    { id: 'emergency_name', type: 'text', label: 'Emergency Contact Name', required: true },
    { id: 'emergency_relationship', type: 'text', label: 'Relationship', required: true },
    { id: 'emergency_phone', type: 'phone', label: 'Emergency Contact Phone', required: true },
  ],
  employment: [
    { id: 'employee_id', type: 'text', label: 'Employee ID', required: false },
    { id: 'department', type: 'select', label: 'Department', required: true },
    { id: 'position', type: 'text', label: 'Position/Title', required: true },
    { id: 'start_date', type: 'date', label: 'Start Date', required: true },
    { id: 'employment_type', type: 'select', label: 'Employment Type', required: true },
  ],
  consent: [
    { id: 'privacy_consent', type: 'checkbox', label: 'I agree to the Privacy Policy', required: true },
    { id: 'terms_consent', type: 'checkbox', label: 'I agree to the Terms and Conditions', required: true },
    { id: 'signature', type: 'signature', label: 'Signature', required: true },
    { id: 'date_signed', type: 'date', label: 'Date', required: true },
  ],
  feedback: [
    { id: 'overall_rating', type: 'rating', label: 'Overall Rating', required: true },
    { id: 'experience', type: 'textarea', label: 'Describe your experience', required: false },
    { id: 'improvements', type: 'textarea', label: 'Suggestions for improvement', required: false },
    { id: 'recommend', type: 'toggle', label: 'Would you recommend us?', required: false },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect field type from label/name
 */
export function detectFieldTypeFromLabel(label: string): FieldType {
  const normalizedLabel = label.toLowerCase().trim();
  
  // Direct match
  if (FIELD_TYPE_PATTERNS[normalizedLabel]) {
    return FIELD_TYPE_PATTERNS[normalizedLabel];
  }
  
  // Partial match
  for (const [pattern, type] of Object.entries(FIELD_TYPE_PATTERNS)) {
    if (normalizedLabel.includes(pattern) || pattern.includes(normalizedLabel)) {
      return type;
    }
  }
  
  // Default to text
  return 'text';
}

/**
 * Get field group suggestions based on form type
 */
export function getFieldGroupSuggestions(formType: FormTypeHint): string[] {
  const groupMap: Record<FormTypeHint, string[]> = {
    registration: ['personalInfo', 'address', 'consent'],
    feedback: ['feedback', 'personalInfo'],
    survey: ['feedback'],
    application: ['personalInfo', 'address', 'employment', 'consent'],
    contact: ['personalInfo'],
    order: ['personalInfo', 'address'],
    booking: ['personalInfo', 'address'],
    assessment: ['personalInfo'],
    compliance: ['consent', 'personalInfo'],
    onboarding: ['personalInfo', 'address', 'emergencyContact', 'employment', 'consent'],
    incident_report: ['personalInfo'],
    time_sheet: ['employment'],
    leave_request: ['employment'],
    expense_claim: ['employment'],
    performance_review: ['employment', 'feedback'],
    training_feedback: ['feedback', 'employment'],
    safety_checklist: ['consent'],
    inspection: ['consent'],
    audit: ['consent'],
    custom: [],
  };
  
  return groupMap[formType] || [];
}