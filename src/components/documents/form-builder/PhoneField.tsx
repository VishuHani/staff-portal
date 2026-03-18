'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { Phone } from 'lucide-react';

/**
 * Format phone number for Australian format
 * Supports formats: 0412345678, 0412 345 678, +61 412 345 678
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Handle Australian mobile numbers
  if (digits.length === 10 && digits.startsWith('04')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  // Handle Australian landline
  if (digits.length === 10 && (digits.startsWith('02') || digits.startsWith('03') || digits.startsWith('07') || digits.startsWith('08'))) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  
  // Handle international format with country code
  if (digits.length === 11 && digits.startsWith('61')) {
    return `+61 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  
  // Default: just return the digits with basic formatting
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }
  
  return digits;
}

/**
 * PhoneField - Phone number with formatting
 */
export function PhoneField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const [displayValue, setDisplayValue] = React.useState(
    value ? formatPhoneNumber(value as string) : ''
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPhoneNumber(rawValue);
    setDisplayValue(formatted);
    
    // Store raw digits for validation/submission
    const digits = rawValue.replace(/\D/g, '');
    onChange(digits || null);
  };

  const handleBlur = () => {
    if (value) {
      setDisplayValue(formatPhoneNumber(value as string));
    }
    onBlur?.();
  };

  return (
    <div className="space-y-2">
      <Label
        htmlFor={field.id}
        className={cn(
          'text-sm font-medium',
          field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
        )}
      >
        {field.label}
      </Label>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={field.id}
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={field.placeholder || '0412 345 678'}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(error && 'border-destructive', 'pl-10')}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.id}-error` : undefined}
        />
      </div>
      {field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}
      {error && (
        <p id={`${field.id}-error`} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}

/**
 * PhoneFieldBuilder - Builder preview for phone field
 */
export function PhoneFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
}: BuilderFieldProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        'p-4 rounded-lg border-2 transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-muted-foreground/25',
        isDragging && 'opacity-50'
      )}
    >
      <div className="space-y-2">
        <Label
          className={cn(
            'text-sm font-medium',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label || 'Phone'}
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="tel"
            placeholder={field.placeholder || '0412 345 678'}
            disabled
            className="bg-muted/50 pl-10"
          />
        </div>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default PhoneField;
