'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

// ============================================================================
// SLIDER FIELD - RENDERER (for form display)
// ============================================================================

interface SliderFieldProps {
  field: FormField;
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  error?: string;
}

export function SliderField({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  error 
}: SliderFieldProps) {
  const min = field.sliderMin ?? 0;
  const max = field.sliderMax ?? 100;
  const step = field.sliderStep ?? 1;
  const unit = field.sliderUnit || '';
  const showValue = field.showSliderValue !== false;
  
  const currentValue = value ?? field.defaultValue as number ?? min;
  
  const percentage = ((currentValue - min) / (max - min)) * 100;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled && onChange) {
      onChange(Number(e.target.value));
    }
  };
  
  const formatValue = (val: number) => {
    if (unit === '$') return `${unit}${val.toLocaleString()}`;
    if (unit === '%') return `${val}${unit}`;
    if (unit) return `${val} ${unit}`;
    return val.toLocaleString();
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </label>
        {showValue && (
          <span className="text-sm font-semibold text-primary">
            {formatValue(currentValue)}
          </span>
        )}
      </div>
      
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      
      {/* Slider */}
      <div className="space-y-2">
        <div className="relative">
          {/* Track background */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            {/* Filled portion */}
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          {/* Range input (invisible, handles interaction) */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              'absolute inset-0 w-full h-2 opacity-0 cursor-pointer',
              disabled && 'cursor-not-allowed'
            )}
            aria-label={field.label}
          />
          
          {/* Thumb indicator */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-primary rounded-full shadow-md transition-all pointer-events-none',
              disabled && 'opacity-50'
            )}
            style={{ left: `calc(${percentage}% - 10px)` }}
          />
        </div>
        
        {/* Min/Max labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
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
// SLIDER FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface SliderFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function SliderFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: SliderFieldBuilderProps) {
  const min = field.sliderMin ?? 0;
  const max = field.sliderMax ?? 100;
  const unit = field.sliderUnit || '';
  
  const formatValue = (val: number) => {
    if (unit === '$') return `${unit}${val.toLocaleString()}`;
    if (unit === '%') return `${val}${unit}`;
    if (unit) return `${val} ${unit}`;
    return val.toLocaleString();
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {field.label || 'Slider'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Slider
          </span>
        </div>
        
        {/* Preview slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">
              {formatValue(min + (max - min) / 2)}
            </span>
          </div>
          
          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full w-1/2" />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md" />
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatValue(min)}</span>
            <span>{formatValue(max)}</span>
          </div>
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

export default SliderField;
