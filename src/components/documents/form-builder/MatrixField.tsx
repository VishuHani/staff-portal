'use client';

import * as React from 'react';
import { Grid, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField, SelectOption } from '@/lib/types/form-schema';

// ============================================================================
// MATRIX FIELD - RENDERER (for form display)
// ============================================================================

interface MatrixFieldProps {
  field: FormField;
  value?: Record<string, string | string[]>;
  onChange?: (value: Record<string, string | string[]>) => void;
  disabled?: boolean;
  error?: string;
}

export function MatrixField({ 
  field, 
  value = {}, 
  onChange, 
  disabled = false,
  error 
}: MatrixFieldProps) {
  const rows = field.matrixRows || [];
  const columns = field.matrixColumns || [];
  const matrixType = field.matrixType || 'radio';
  
  const handleRadioChange = (rowValue: string, columnValue: string) => {
    if (disabled) return;
    onChange?.({
      ...value,
      [rowValue]: columnValue,
    });
  };
  
  const handleCheckboxChange = (rowValue: string, columnValue: string, checked: boolean) => {
    if (disabled) return;
    const currentValues = (value[rowValue] as string[]) || [];
    
    if (checked) {
      onChange?.({
        ...value,
        [rowValue]: [...currentValues, columnValue],
      });
    } else {
      onChange?.({
        ...value,
        [rowValue]: currentValues.filter((v) => v !== columnValue),
      });
    }
  };
  
  const isChecked = (rowValue: string, columnValue: string): boolean => {
    if (matrixType === 'radio') {
      return value[rowValue] === columnValue;
    } else {
      return ((value[rowValue] as string[]) || []).includes(columnValue);
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      {rows.length === 0 || columns.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">
          Matrix not configured. Add rows and columns in field settings.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium border-b"></th>
                {columns.map((column) => (
                  <th
                    key={column.value}
                    className="p-2 text-center text-sm font-medium border-b"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.value}>
                  <td className="p-2 text-sm border-b">{row.label}</td>
                  {columns.map((column) => (
                    <td
                      key={`${row.value}-${column.value}`}
                      className="p-2 text-center border-b"
                    >
                      {matrixType === 'radio' ? (
                        <input
                          type="radio"
                          name={`matrix-${field.id}-${row.value}`}
                          checked={isChecked(row.value, column.value)}
                          onChange={() => handleRadioChange(row.value, column.value)}
                          disabled={disabled}
                          className="h-4 w-4"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isChecked(row.value, column.value)}
                          onChange={(e) =>
                            handleCheckboxChange(row.value, column.value, e.target.checked)
                          }
                          disabled={disabled}
                          className="h-4 w-4"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// MATRIX FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface MatrixFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function MatrixFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: MatrixFieldBuilderProps) {
  const rows = field.matrixRows || [];
  const columns = field.matrixColumns || [];
  const matrixType = field.matrixType || 'radio';
  
  // Preview with sample data if empty
  const previewRows = rows.length > 0 ? rows.slice(0, 3) : [
    { value: 'row1', label: 'Row 1' },
    { value: 'row2', label: 'Row 2' },
  ];
  const previewColumns = columns.length > 0 ? columns.slice(0, 4) : [
    { value: 'col1', label: 'Col 1' },
    { value: 'col2', label: 'Col 2' },
    { value: 'col3', label: 'Col 3' },
  ];
  
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
      {/* Drag handle indicator */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      
      {/* Field content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {field.label || 'Matrix/Grid'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Matrix
          </span>
        </div>
        
        {/* Preview matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left font-medium border-b"></th>
                {previewColumns.map((column) => (
                  <th
                    key={column.value}
                    className="p-1 text-center font-medium border-b"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.value}>
                  <td className="p-1 border-b">{row.label}</td>
                  {previewColumns.map((column) => (
                    <td
                      key={`${row.value}-${column.value}`}
                      className="p-1 text-center border-b"
                    >
                      {matrixType === 'radio' ? (
                        <div className="w-3 h-3 rounded-full border border-muted-foreground mx-auto" />
                      ) : (
                        <div className="w-3 h-3 rounded border border-muted-foreground mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {(rows.length === 0 || columns.length === 0) && (
          <p className="text-xs text-muted-foreground italic">
            Click to configure rows and columns
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
// MATRIX FIELD - CONFIG (for field settings panel)
// ============================================================================

interface MatrixFieldConfigProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function MatrixFieldConfig({ field, onUpdate }: MatrixFieldConfigProps) {
  const rows = field.matrixRows || [];
  const columns = field.matrixColumns || [];
  const matrixType = field.matrixType || 'radio';
  
  const addRow = () => {
    const newRow: SelectOption = {
      value: `row_${Date.now()}`,
      label: `Row ${rows.length + 1}`,
    };
    onUpdate({ matrixRows: [...rows, newRow] });
  };
  
  const updateRow = (index: number, label: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], label };
    onUpdate({ matrixRows: newRows });
  };
  
  const removeRow = (index: number) => {
    onUpdate({ matrixRows: rows.filter((_, i) => i !== index) });
  };
  
  const addColumn = () => {
    const newColumn: SelectOption = {
      value: `col_${Date.now()}`,
      label: `Col ${columns.length + 1}`,
    };
    onUpdate({ matrixColumns: [...columns, newColumn] });
  };
  
  const updateColumn = (index: number, label: string) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], label };
    onUpdate({ matrixColumns: newColumns });
  };
  
  const removeColumn = (index: number) => {
    onUpdate({ matrixColumns: columns.filter((_, i) => i !== index) });
  };
  
  return (
    <div className="space-y-4">
      {/* Matrix Type */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Selection Type</label>
        <select
          value={matrixType}
          onChange={(e) => onUpdate({ matrixType: e.target.value as 'radio' | 'checkbox' })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        >
          <option value="radio">Single Selection (Radio)</option>
          <option value="checkbox">Multiple Selection (Checkbox)</option>
        </select>
      </div>
      
      {/* Rows */}
      <div className="space-y-2">
        <label className="text-xs font-medium">Rows</label>
        <div className="space-y-1">
          {rows.map((row, index) => (
            <div key={row.value} className="flex gap-1">
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(index, e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded bg-background"
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
        >
          <Plus className="h-3 w-3" />
          Add Row
        </button>
      </div>
      
      {/* Columns */}
      <div className="space-y-2">
        <label className="text-xs font-medium">Columns</label>
        <div className="space-y-1">
          {columns.map((column, index) => (
            <div key={column.value} className="flex gap-1">
              <input
                type="text"
                value={column.label}
                onChange={(e) => updateColumn(index, e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded bg-background"
              />
              <button
                type="button"
                onClick={() => removeColumn(index)}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addColumn}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
        >
          <Plus className="h-3 w-3" />
          Add Column
        </button>
      </div>
    </div>
  );
}

export default MatrixField;
