'use client';

import * as React from 'react';
import { Frown, Meh, Smile, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

// ============================================================================
// SCALE FIELD - RENDERER (for form display)
// ============================================================================

interface ScaleFieldProps {
  field: FormField;
  value?: number | null;
  onChange?: (value: number) => void;
  disabled?: boolean;
  error?: string;
}

export function ScaleField({ 
  field, 
  value = null, 
  onChange, 
  disabled = false,
  error 
}: ScaleFieldProps) {
  const min = field.scaleMin ?? 1;
  const max = field.scaleMax ?? 10;
  const style = field.scaleStyle || 'numbers';
  const minLabel = field.scaleMinLabel || 'Not likely';
  const maxLabel = field.scaleMaxLabel || 'Very likely';
  
  const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  
  const getFaceIcon = (index: number, total: number) => {
    const position = index / (total - 1); // 0 to 1
    if (position < 0.33) return Frown;
    if (position < 0.66) return Meh;
    return Smile;
  };
  
  const getColorClass = (index: number, total: number, isSelected: boolean) => {
    const position = index / (total - 1); // 0 to 1
    if (!isSelected) return 'border-gray-300 text-gray-500';
    
    if (position < 0.33) return 'bg-red-500 border-red-500 text-white';
    if (position < 0.66) return 'bg-yellow-500 border-yellow-500 text-white';
    return 'bg-green-500 border-green-500 text-white';
  };
  
  const handleClick = (val: number) => {
    if (!disabled && onChange) {
      onChange(val);
    }
  };
  
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      
      {/* Scale buttons */}
      <div className="space-y-2">
        <div className="flex justify-between gap-1">
          {scaleValues.map((val, index) => {
            const isSelected = value === val;
            const Icon = style === 'faces' ? getFaceIcon(index, scaleValues.length) : null;
            
            return (
              <button
                key={val}
                type="button"
                onClick={() => handleClick(val)}
                disabled={disabled}
                className={cn(
                  'flex-1 h-10 flex items-center justify-center rounded-lg border-2 transition-all font-medium text-sm',
                  style === 'numbers' && getColorClass(index, scaleValues.length, isSelected),
                  style === 'faces' && isSelected && 'ring-2 ring-primary ring-offset-2',
                  style === 'gradient' && (
                    isSelected 
                      ? 'bg-primary border-primary text-primary-foreground scale-110' 
                      : 'border-gray-300 text-gray-600 hover:border-primary/50'
                  ),
                  disabled && 'cursor-not-allowed opacity-50',
                  !isSelected && style === 'numbers' && 'hover:border-primary/50'
                )}
                aria-label={`Rate ${val}`}
                aria-pressed={isSelected}
              >
                {style === 'faces' && Icon ? (
                  <Icon className={cn(
                    'w-6 h-6',
                    isSelected ? 'text-primary' : 'text-gray-400'
                  )} />
                ) : (
                  val
                )}
              </button>
            );
          })}
        </div>
        
        {/* Labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {style === 'gradient' && <ThumbsDown className="w-3 h-3" />}
            {minLabel}
          </span>
          <span className="flex items-center gap-1">
            {maxLabel}
            {style === 'gradient' && <ThumbsUp className="w-3 h-3" />}
          </span>
        </div>
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
// SCALE FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface ScaleFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function ScaleFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: ScaleFieldBuilderProps) {
  const min = field.scaleMin ?? 1;
  const max = field.scaleMax ?? 10;
  const scaleValues = Array.from({ length: Math.min(max - min + 1, 10) }, (_, i) => min + i);
  
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {field.label || 'Scale'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Scale (NPS)
          </span>
        </div>
        
        {/* Preview scale */}
        <div className="flex justify-between gap-0.5">
          {scaleValues.map((val) => (
            <div
              key={val}
              className="flex-1 h-8 flex items-center justify-center rounded border border-gray-300 text-xs text-gray-500"
            >
              {val}
            </div>
          ))}
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{field.scaleMinLabel || 'Not likely'}</span>
          <span>{field.scaleMaxLabel || 'Very likely'}</span>
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

export default ScaleField;
