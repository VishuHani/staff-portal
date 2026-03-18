/**
 * Form Test Types
 * 
 * Types for form testing, test scenarios, and validation testing.
 */

import { FormSchema, FormData, FormField } from './form-schema';

// ============================================================================
// TEST SCENARIO TYPES
// ============================================================================

/**
 * Represents a saved test scenario for a form
 */
export interface FormTestScenario {
  id: string;
  name: string;
  description?: string;
  formId: string;
  formData: FormData;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags?: string[];
  isDefault?: boolean;
}

/**
 * Props for creating a new test scenario
 */
export interface CreateTestScenarioInput {
  name: string;
  description?: string;
  formId: string;
  formData: FormData;
  tags?: string[];
  isDefault?: boolean;
}

/**
 * Props for updating a test scenario
 */
export interface UpdateTestScenarioInput {
  name?: string;
  description?: string;
  formData?: FormData;
  tags?: string[];
  isDefault?: boolean;
}

// ============================================================================
// TEST RESULT TYPES
// ============================================================================

/**
 * Status of an individual field in a test
 */
export type FieldTestStatus = 'passed' | 'failed' | 'skipped' | 'warning';

/**
 * Result of testing a single field
 */
export interface FieldTestResult {
  fieldId: string;
  fieldLabel: string;
  status: FieldTestStatus;
  message?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  conditionResults?: ConditionTestResult[];
}

/**
 * Result of testing a conditional logic rule
 */
export interface ConditionTestResult {
  conditionId: string;
  fieldId: string;
  operator: string;
  expectedValue: unknown;
  actualValue: unknown;
  passed: boolean;
  message?: string;
}

/**
 * Overall result of a form test
 */
export interface FormTestResult {
  id: string;
  scenarioId?: string;
  formId: string;
  timestamp: string;
  overallStatus: 'passed' | 'failed' | 'warning';
  summary: {
    totalFields: number;
    passedFields: number;
    failedFields: number;
    skippedFields: number;
    warningFields: number;
  };
  fieldResults: FieldTestResult[];
  validationErrors: ValidationError[];
  conditionalLogicResults: ConditionTestResult[];
  duration: number; // in milliseconds
}

/**
 * Validation error from form testing
 */
export interface ValidationError {
  fieldId: string;
  fieldLabel: string;
  type: 'required' | 'format' | 'range' | 'custom' | 'condition';
  message: string;
}

// ============================================================================
// TEST CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for form testing
 */
export interface FormTestConfig {
  validateRequired: boolean;
  validateFormats: boolean;
  validateRanges: boolean;
  validateConditionalLogic: boolean;
  stopOnFirstError: boolean;
  includeWarnings: boolean;
  customValidators?: CustomValidator[];
}

/**
 * Custom validator function type
 */
export interface CustomValidator {
  id: string;
  name: string;
  fieldTypes: string[]; // Field types this validator applies to
  validate: (value: unknown, field: FormField, formData: FormData) => ValidationResult;
}

/**
 * Result of a validation check
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  type?: 'error' | 'warning' | 'info';
}

// ============================================================================
// TEST RUNNER TYPES
// ============================================================================

/**
 * Options for running a form test
 */
export interface RunTestOptions {
  scenarioId?: string;
  formData?: FormData;
  config?: Partial<FormTestConfig>;
  onSaveResult?: boolean;
}

/**
 * State of a test run
 */
export interface TestRunState {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  currentField?: string;
  result?: FormTestResult;
  error?: string;
}

// ============================================================================
// TEST ASSERTION TYPES
// ============================================================================

/**
 * Assertion for testing field values
 */
export interface FieldAssertion {
  fieldId: string;
  assertionType: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'matches' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  expectedValue?: unknown;
  message?: string;
}

/**
 * Assertion for testing conditional logic
 */
export interface ConditionalAssertion {
  fieldId: string;
  expectedVisibility: 'visible' | 'hidden';
  condition?: string; // Condition description
  message?: string;
}

/**
 * Collection of assertions for a test scenario
 */
export interface TestAssertions {
  fieldAssertions: FieldAssertion[];
  conditionalAssertions: ConditionalAssertion[];
}

// ============================================================================
// TEST HISTORY TYPES
// ============================================================================

/**
 * Historical test run record
 */
export interface TestHistoryEntry {
  id: string;
  scenarioId?: string;
  scenarioName?: string;
  formId: string;
  timestamp: string;
  status: 'passed' | 'failed' | 'warning';
  duration: number;
  errorCount: number;
  warningCount: number;
}

/**
 * Statistics for test runs
 */
export interface TestStatistics {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  warningRuns: number;
  averageDuration: number;
  passRate: number;
  mostCommonErrors: Array<{
    message: string;
    count: number;
  }>;
}

// ============================================================================
// TEST EXPORT/IMPORT TYPES
// ============================================================================

/**
 * Exported test scenario format
 */
export interface ExportedTestScenario {
  version: string;
  exportedAt: string;
  scenario: FormTestScenario;
  assertions?: TestAssertions;
}

/**
 * Import result for test scenarios
 */
export interface ImportTestScenarioResult {
  success: boolean;
  scenario?: FormTestScenario;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a default test configuration
 */
export function createDefaultTestConfig(): FormTestConfig {
  return {
    validateRequired: true,
    validateFormats: true,
    validateRanges: true,
    validateConditionalLogic: true,
    stopOnFirstError: false,
    includeWarnings: true,
  };
}

/**
 * Creates an empty test result
 */
export function createEmptyTestResult(formId: string): FormTestResult {
  return {
    id: `test_${Date.now()}`,
    formId,
    timestamp: new Date().toISOString(),
    overallStatus: 'passed',
    summary: {
      totalFields: 0,
      passedFields: 0,
      failedFields: 0,
      skippedFields: 0,
      warningFields: 0,
    },
    fieldResults: [],
    validationErrors: [],
    conditionalLogicResults: [],
    duration: 0,
  };
}

/**
 * Creates a new test scenario
 */
export function createNewTestScenario(
  formId: string,
  name: string,
  formData: FormData = {}
): FormTestScenario {
  return {
    id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    formId,
    formData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    isDefault: false,
  };
}
