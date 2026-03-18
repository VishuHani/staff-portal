'use client';

import * as React from 'react';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

// ============================================================================
// CURRENCY FIELD - RENDERER (for form display)
// ============================================================================

interface CurrencyFieldProps {
  field: FormField;
  value?: number | null;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
  error?: string;
}

// Common currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: '$',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CAD: '$',
  NZD: '$',
  SGD: '$',
  HKD: '$',
  INR: '₹',
  KRW: '₩',
  BRL: 'R$',
  MXN: '$',
  CHF: 'CHF',
};

export function CurrencyField({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  error 
}: CurrencyFieldProps) {
  const currencyCode = field.currencyCode || 'AUD';
  const symbol = CURRENCY_SYMBOLS[currencyCode] || '$';
  const min = field.min ?? undefined;
  const max = field.max ?? undefined;
  const step = field.step ?? 0.01;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue === '') {
      onChange?.(null);
    } else {
      const parsed = parseFloat(newValue);
      if (!isNaN(parsed)) {
        onChange?.(parsed);
      }
    }
  };
  
  const formatDisplayValue = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return val.toFixed(2);
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
          {symbol}
        </span>
        <input
          type="number"
          value={formatDisplayValue(value)}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          placeholder={field.placeholder || '0.00'}
          className={cn(
            'w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50',
            error && 'border-destructive'
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {currencyCode}
        </span>
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
// CURRENCY FIELD - BUILDER (for form builder configuration)
// ============================================================================

interface CurrencyFieldBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function CurrencyFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: CurrencyFieldBuilderProps) {
  const currencyCode = field.currencyCode || 'AUD';
  const symbol = CURRENCY_SYMBOLS[currencyCode] || '$';
  
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
            {field.label || 'Currency'}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Currency
          </span>
        </div>
        
        {/* Preview input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            {symbol}
          </span>
          <input
            type="text"
            value="0.00"
            readOnly
            className="w-full pl-8 pr-12 py-2 text-sm border rounded-md bg-muted/50"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {currencyCode}
          </span>
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

export default CurrencyField;
