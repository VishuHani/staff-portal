'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField, FieldError } from '@/lib/types/form-schema';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';

/**
 * TextField - Single-line text input with validation
 */
export function TextField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
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
      <Input
        id={field.id}
        type="text"
        value={(value as string) ?? ''}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={field.placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(error && 'border-destructive')}
        aria-invalid={!!error}
        aria-describedby={error ? `${field.id}-error` : undefined}
      />
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
 * TextFieldBuilder - Builder preview for text field
 */
export function TextFieldBuilder({
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
          {field.label || 'Text Field'}
        </Label>
        <Input
          type="text"
          placeholder={field.placeholder || 'Enter text...'}
          disabled
          className="bg-muted/50"
        />
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default TextField;
