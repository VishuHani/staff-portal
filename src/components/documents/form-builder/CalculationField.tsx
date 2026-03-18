'use client';

import * as React from 'react';
import { Calculator, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField, FormSchema } from '@/lib/types/form-schema';

// ============================================================================
// CALCULATION ENGINE
// ============================================================================

/**
 * Evaluates a formula string using field values
 * Supports: +, -, *, /, (), SUM, AVG, MIN, MAX, IF, ROUND
 */
export function evaluateFormula(
  formula: string,
  fieldValues: Record<string, number | string | boolean | null | undefined>
): { result: number | null; error: string | null } {
  if (!formula || formula.trim() === '') {
    return { result: null, error: null };
  }
  
  try {
    // Replace field references with values
    let processedFormula = formula;
    
    // Replace {field_id} with actual values
    const fieldRefRegex = /\{([^}]+)\}/g;
    processedFormula = processedFormula.replace(fieldRefRegex, (match, fieldId) => {
      const value = fieldValues[fieldId];
      if (value === null || value === undefined || value === '') {
        return '0'; // Default to 0 for empty fields
      }
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error(`Invalid value for field ${fieldId}`);
      }
      return numValue.toString();
    });
    
    // Replace function names with JavaScript equivalents
    processedFormula = processedFormula
      .replace(/SUM\(/gi, '(')
      .replace(/AVG\(/gi, '((')
      .replace(/MIN\(/gi, 'Math.min(')
      .replace(/MAX\(/gi, 'Math.max(')
      .replace(/ROUND\(/gi, 'Math.round(')
      .replace(/SQRT\(/gi, 'Math.sqrt(')
      .replace(/ABS\(/gi, 'Math.abs(')
      .replace(/POWER\(/gi, 'Math.pow(');
    
    // Handle IF function: IF(condition, trueValue, falseValue)
    // This is a simplified version - for complex conditions, use a proper expression parser
    const ifRegex = /IF\(([^,]+),([^,]+),([^)]+)\)/gi;
    processedFormula = processedFormula.replace(ifRegex, '(($1) ? ($2) : ($3))');
    
    // Validate formula - only allow safe characters
    const safePattern = /^[0-9+\-*/().,%\s]+$|Math\.(min|max|round|sqrt|abs|pow)\([^)]*\)/g;
    if (!safePattern.test(processedFormula.replace(/\?|:/g, ''))) {
      // Check for potentially dangerous code
      if (/[a-zA-Z_$][a-zA-Z0-9_$]*/.test(processedFormula.replace(/Math\./g, ''))) {
        throw new Error('Invalid characters in formula');
      }
    }
    
    // Evaluate the formula
    // Using Function constructor for safe evaluation
    const evaluate = new Function(`return (${processedFormula})`);
    const result = evaluate();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid calculation result');
    }
    
    return { result, error: null };
  } catch (err) {
    return { 
      result: null, 
      error: err instanceof Error ? err.message : 'Invalid formula' 
    };
  }
}

/**
 * Get all fields that can be referenced in a formula
 */
export function getFormulaFields(schema: FormSchema, currentFieldId: string): FormField[] {
  return schema.fields.filter(
    (f) => 
      f.id !== currentFieldId && 
      ['number', 'currency', 'percentage', 'rating', 'scale', 'slider', 'calculation'].includes(f.type)
  );
}

// ============================================================================
// CALCULATION FIELD - RENDERER (for form display)
// ============================================================================

interface CalculationFieldProps {
  field: FormField;
  value?: number;
  allFieldValues?: Record<string, unknown>;
  disabled?: boolean;
  error?: string;
}

export function CalculationField({ 
  field, 
  value,
  allFieldValues = {},
  disabled = true, // Calculations are usually auto-computed
  error 
}: CalculationFieldProps) {
  const displayFormat = field.displayFormat || 'number';
  const decimalPlaces = field.decimalPlaces ?? 2;
  const currencySymbol = field.currencySymbol || '$';
  
  const formatValue = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '-';
    
    switch (displayFormat) {
      case 'currency':
        return `${currencySymbol}${val.toFixed(decimalPlaces)}`;
      case 'percentage':
        return `${val.toFixed(decimalPlaces)}%`;
      default:
        return val.toFixed(decimalPlaces);
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Calculator className="w-4 h-4 text-muted-foreground" />
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      
      {/* Display calculated value */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg border bg-muted/50',
        error && 'border-destructive'
      )}>
        <span className="text-lg font-semibold">
          {formatValue(value as number)}
        </span>
        {field.formula && (
          <span className="text-xs text-muted-foreground font-mono">
            {field.formula.substring(0, 30)}{field.formula.length > 30 ? '...' : ''}
          </span>
        )}
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
      
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}

// ============================================================================
// CALCULATION FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface CalculationFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function CalculationFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: CalculationFieldBuilderProps) {
  const displayFormat = field.displayFormat || 'number';
  const currencySymbol = field.currencySymbol || '$';
  
  const getPreviewValue = () => {
    switch (displayFormat) {
      case 'currency':
        return `${currencySymbol}0.00`;
      case 'percentage':
        return '0%';
      default:
        return '0';
    }
  };
  
  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-lg border-2 transition-all cursor-pointer group',
        isSelected 
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/50'
      )}
    >
      {/* Field content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" />
            {field.label || 'Calculation'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Calculation
          </span>
        </div>
        
        {/* Preview */}
        <div className="flex items-center justify-between p-2 rounded border bg-muted/50">
          <span className="text-sm font-semibold">{getPreviewValue()}</span>
          {field.formula && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
              {field.formula}
            </span>
          )}
        </div>
        
        {!field.formula && (
          <p className="text-xs text-muted-foreground italic">
            No formula configured
          </p>
        )}
        
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FORMULA BUILDER COMPONENT
// ============================================================================

interface FormulaBuilderProps {
  field: FormField;
  availableFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
}

export function FormulaBuilder({ field, availableFields, onUpdate }: FormulaBuilderProps) {
  const [testValues, setTestValues] = React.useState<Record<string, number>>({});
  
  const handleInsertField = (fieldId: string) => {
    const currentFormula = field.formula || '';
    onUpdate({ formula: `${currentFormula}{${fieldId}}` });
  };
  
  const handleInsertOperator = (operator: string) => {
    const currentFormula = field.formula || '';
    onUpdate({ formula: `${currentFormula}${operator}` });
  };
  
  const testResult = React.useMemo(() => {
    if (!field.formula) return { result: null, error: null };
    return evaluateFormula(field.formula, testValues);
  }, [field.formula, testValues]);
  
  return (
    <div className="space-y-4">
      {/* Formula input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Formula</label>
        <textarea
          value={field.formula || ''}
          onChange={(e) => onUpdate({ formula: e.target.value })}
          placeholder="e.g., {field_1} * {field_2}"
          className="w-full px-3 py-2 text-sm font-mono border rounded-md min-h-[80px] bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Use {'{field_id}'} to reference other fields. Supports: +, -, *, /, (, ), SUM, AVG, MIN, MAX, ROUND
        </p>
      </div>
      
      {/* Quick insert buttons */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Insert Field</label>
        <div className="flex flex-wrap gap-1">
          {availableFields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleInsertField(f.id)}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded border"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Operators */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Operators</label>
        <div className="flex flex-wrap gap-1">
          {['+', '-', '*', '/', '(', ')', 'SUM()', 'AVG()', 'MIN()', 'MAX()', 'ROUND()'].map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => handleInsertOperator(op)}
              className="px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 rounded border border-primary/20"
            >
              {op}
            </button>
          ))}
        </div>
      </div>
      
      {/* Display format */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Display Format</label>
        <select
          value={field.displayFormat || 'number'}
          onChange={(e) => onUpdate({ displayFormat: e.target.value as 'number' | 'currency' | 'percentage' })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        >
          <option value="number">Number</option>
          <option value="currency">Currency</option>
          <option value="percentage">Percentage</option>
        </select>
      </div>
      
      {/* Decimal places */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Decimal Places</label>
        <input
          type="number"
          value={field.decimalPlaces ?? 2}
          onChange={(e) => onUpdate({ decimalPlaces: Number(e.target.value) })}
          min={0}
          max={10}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        />
      </div>
      
      {/* Currency symbol (if currency format) */}
      {field.displayFormat === 'currency' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Currency Symbol</label>
          <input
            type="text"
            value={field.currencySymbol || '$'}
            onChange={(e) => onUpdate({ currencySymbol: e.target.value })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </div>
      )}
      
      {/* Test result */}
      {field.formula && (
        <div className="p-3 rounded-lg border bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Preview:</p>
          <p className="text-lg font-semibold">
            {testResult.error ? (
              <span className="text-destructive text-sm">{testResult.error}</span>
            ) : (
              testResult.result?.toFixed(field.decimalPlaces ?? 2) ?? '-'
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default CalculationField;
