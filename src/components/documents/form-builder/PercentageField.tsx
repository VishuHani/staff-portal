'use client';

import * as React from 'react';
import { Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

// ============================================================================
// PERCENTAGE FIELD - RENDERER (for form display)
// ============================================================================

interface PercentageFieldProps {
  field: FormField;
  value?: number | null;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
  error?: string;
}

export function PercentageField({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  error 
}: PercentageFieldProps) {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue === '') {
      onChange?.(null);
    } else {
      const parsed = parseFloat(newValue);
      if (!isNaN(parsed)) {
        // Clamp value between min and max
        const clampedValue = Math.min(Math.max(parsed, min), max);
        onChange?.(clampedValue);
      }
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          type="number"
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          placeholder={field.placeholder || '0'}
          className={cn(
            'w-full pr-10 pl-3 py-2 text-sm border rounded-md bg-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50',
            error && 'border-destructive'
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
          %
        </span>
      </div>
      
      {/* Min/Max indicator */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Min: {min}%</span>
        <span>Max: {max}%</span>
      </div>
      
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
// PERCENTAGE FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface PercentageFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function PercentageFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: PercentageFieldBuilderProps) {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  
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
            {field.label || 'Percentage'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Percentage
          </span>
        </div>
        
        {/* Preview input */}
        <div className="relative">
          <input
            type="text"
            value="50"
            readOnly
            className="w-full pr-10 pl-3 py-2 text-sm border rounded-md bg-muted/50"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            %
          </span>
        </div>
        
        {/* Min/Max indicator */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Min: {min}%</span>
          <span>Max: {max}%</span>
        </div>
        
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

export default PercentageField;
