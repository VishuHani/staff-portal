'use server';

import { createClient } from '@/lib/auth/supabase-server';
import {
  FormTestScenario,
  CreateTestScenarioInput,
  UpdateTestScenarioInput,
  FormTestResult,
  FormTestConfig,
  FieldTestResult,
  createDefaultTestConfig,
  createEmptyTestResult,
} from '@/lib/types/form-test';
import { FormSchema, FormData, FormField } from '@/lib/types/form-schema';

// ============================================================================
// IN-MEMORY STORAGE (for development)
// In production, this would use a database
// ============================================================================

// Temporary in-memory storage for test scenarios
const scenarioStore = new Map<string, FormTestScenario[]>();
const historyStore = new Map<string, FormTestResult[]>();

// ============================================================================
// AUTHENTICATION HELPER
// ============================================================================

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ============================================================================
// TEST SCENARIO CRUD OPERATIONS
// ============================================================================

/**
 * Get all test scenarios for a form
 */
export async function getTestScenarios(formId: string): Promise<FormTestScenario[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    return scenarioStore.get(formId) || [];
  } catch (error) {
    console.error('Error fetching test scenarios:', error);
    return [];
  }
}

/**
 * Get a single test scenario by ID
 */
export async function getTestScenario(
  formId: string,
  scenarioId: string
): Promise<FormTestScenario | null> {
  const scenarios = await getTestScenarios(formId);
  return scenarios.find(s => s.id === scenarioId) || null;
}

/**
 * Create a new test scenario
 */
export async function createTestScenario(
  input: CreateTestScenarioInput
): Promise<FormTestScenario> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const existingScenarios = scenarioStore.get(input.formId) || [];

    const newScenario: FormTestScenario = {
      id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      description: input.description,
      formId: input.formId,
      formData: input.formData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
      tags: input.tags || [],
      isDefault: input.isDefault || existingScenarios.length === 0,
    };

    // If this is set as default, remove default from others
    const updatedScenarios = newScenario.isDefault
      ? existingScenarios.map(s => ({ ...s, isDefault: false }))
      : existingScenarios;

    updatedScenarios.push(newScenario);
    scenarioStore.set(input.formId, updatedScenarios);

    return newScenario;
  } catch (error) {
    console.error('Error creating test scenario:', error);
    throw error;
  }
}

/**
 * Update an existing test scenario
 */
export async function updateTestScenario(
  formId: string,
  scenarioId: string,
  input: UpdateTestScenarioInput
): Promise<FormTestScenario> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const existingScenarios = scenarioStore.get(formId) || [];

    const scenarioIndex = existingScenarios.findIndex(s => s.id === scenarioId);
    if (scenarioIndex === -1) {
      throw new Error('Scenario not found');
    }

    const updatedScenario: FormTestScenario = {
      ...existingScenarios[scenarioIndex],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    // If this is set as default, remove default from others
    let updatedScenarios = [...existingScenarios];
    if (input.isDefault) {
      updatedScenarios = updatedScenarios.map(s => ({ ...s, isDefault: s.id === scenarioId }));
    }

    updatedScenarios[scenarioIndex] = updatedScenario;
    scenarioStore.set(formId, updatedScenarios);

    return updatedScenario;
  } catch (error) {
    console.error('Error updating test scenario:', error);
    throw error;
  }
}

/**
 * Delete a test scenario
 */
export async function deleteTestScenario(
  formId: string,
  scenarioId: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const existingScenarios = scenarioStore.get(formId) || [];
    const updatedScenarios = existingScenarios.filter(s => s.id !== scenarioId);
    scenarioStore.set(formId, updatedScenarios);
  } catch (error) {
    console.error('Error deleting test scenario:', error);
    throw error;
  }
}

// ============================================================================
// TEST EXECUTION OPERATIONS
// ============================================================================

/**
 * Run validation tests on form data
 */
export async function runFormTest(
  schema: FormSchema,
  formData: FormData,
  config: Partial<FormTestConfig> = {}
): Promise<FormTestResult> {
  const startTime = Date.now();
  const fullConfig = { ...createDefaultTestConfig(), ...config };
  const result = createEmptyTestResult(schema.id);

  result.summary.totalFields = schema.fields.length;

  for (const field of schema.fields) {
    const fieldResult = testField(field, formData, schema, fullConfig);
    result.fieldResults.push(fieldResult);

    // Update summary
    switch (fieldResult.status) {
      case 'passed':
        result.summary.passedFields++;
        break;
      case 'failed':
        result.summary.failedFields++;
        if (fullConfig.stopOnFirstError) {
          break;
        }
        break;
      case 'skipped':
        result.summary.skippedFields++;
        break;
      case 'warning':
        result.summary.warningFields++;
        break;
    }

    // Add validation errors
    if (fieldResult.status === 'failed') {
      result.validationErrors.push({
        fieldId: field.id,
        fieldLabel: field.label,
        type: 'required',
        message: fieldResult.message || `Field "${field.label}" failed validation`,
      });
    }
  }

  // Determine overall status
  if (result.summary.failedFields > 0) {
    result.overallStatus = 'failed';
  } else if (result.summary.warningFields > 0) {
    result.overallStatus = 'warning';
  } else {
    result.overallStatus = 'passed';
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Test a single field
 */
function testField(
  field: FormField,
  formData: FormData,
  schema: FormSchema,
  config: FormTestConfig
): FieldTestResult {
  const value = formData[field.id];
  const result: FieldTestResult = {
    fieldId: field.id,
    fieldLabel: field.label,
    status: 'passed',
  };

  // Check required validation
  if (config.validateRequired && field.required) {
    if (value === undefined || value === null || value === '') {
      result.status = 'failed';
      result.message = 'Field is required but has no value';
      return result;
    }
  }

  // Check format validation
  if (config.validateFormats && value !== undefined && value !== null && value !== '') {
    const formatError = validateFieldFormat(field, value);
    if (formatError) {
      result.status = 'failed';
      result.message = formatError;
      return result;
    }
  }

  // Check range validation
  if (config.validateRanges && value !== undefined && value !== null) {
    const rangeError = validateFieldRange(field, value);
    if (rangeError) {
      result.status = 'failed';
      result.message = rangeError;
      return result;
    }
  }

  // Check conditional logic
  if (config.validateConditionalLogic && field.conditionalLogic) {
    // For now, just note that conditional logic exists
    // In a full implementation, you'd evaluate the condition groups
    result.conditionResults = field.conditionalLogic.conditionGroups.flatMap((group, groupIndex) => 
      group.conditions.map((condition, condIndex) => {
        const cond = condition as { id: string; fieldId: string; operator: string; value: unknown };
        return {
          conditionId: cond.id || `condition_${groupIndex}_${condIndex}`,
          fieldId: cond.fieldId,
          operator: cond.operator,
          expectedValue: cond.value,
          actualValue: formData[cond.fieldId],
          passed: true, // Placeholder
          message: `Condition ${groupIndex + 1}.${condIndex + 1} evaluated`,
        };
      })
    );
  }

  return result;
}

/**
 * Validate field format
 */
function validateFieldFormat(field: FormField, value: unknown): string | null {
  switch (field.type) {
    case 'email':
      if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Invalid email format';
      }
      break;
    case 'phone':
      if (typeof value === 'string' && !/^[\d\s\-+()]+$/.test(value)) {
        return 'Invalid phone format';
      }
      break;
    case 'url':
      try {
        if (typeof value === 'string') {
          new URL(value.startsWith('http') ? value : `https://${value}`);
        }
      } catch {
        return 'Invalid URL format';
      }
      break;
  }
  return null;
}

/**
 * Validate field range
 */
function validateFieldRange(field: FormField, value: unknown): string | null {
  if (field.type === 'number' || field.type === 'currency' || field.type === 'percentage') {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      if (field.min !== undefined && numValue < field.min) {
        return `Value must be at least ${field.min}`;
      }
      if (field.max !== undefined && numValue > field.max) {
        return `Value must be at most ${field.max}`;
      }
    }
  }

  if (field.type === 'text' || field.type === 'textarea') {
    const strValue = String(value);
    
    if (field.min !== undefined && strValue.length < field.min) {
      return `Must be at least ${field.min} characters`;
    }
    if (field.max !== undefined && strValue.length > field.max) {
      return `Must be at most ${field.max} characters`;
    }
  }

  return null;
}

// ============================================================================
// TEST HISTORY OPERATIONS
// ============================================================================

/**
 * Save test result to history
 */
export async function saveTestResult(
  formId: string,
  result: FormTestResult
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const existingHistory = historyStore.get(formId) || [];

    // Keep only last 50 results
    const updatedHistory = [result, ...existingHistory].slice(0, 50);
    historyStore.set(formId, updatedHistory);
  } catch (error) {
    console.error('Error saving test result:', error);
    throw error;
  }
}

/**
 * Get test history for a form
 */
export async function getTestHistory(
  formId: string,
  limit: number = 20
): Promise<FormTestResult[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const history = historyStore.get(formId) || [];
    return history.slice(0, limit);
  } catch (error) {
    console.error('Error fetching test history:', error);
    return [];
  }
}
