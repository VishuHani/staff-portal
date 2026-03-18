'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

/**
 * SelectField - Dropdown select
 */
export function SelectField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const handleValueChange = (newValue: string) => {
    onChange(newValue || null);
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
      <Select
        value={(value as string) ?? ''}
        onValueChange={handleValueChange}
        disabled={disabled || readOnly}
      >
        <SelectTrigger
          className={cn('w-full', error && 'border-destructive')}
          onBlur={onBlur}
        >
          <SelectValue placeholder={field.placeholder || 'Select an option'} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  );
}

/**
 * SelectFieldBuilder - Builder preview for select field
 */
export function SelectFieldBuilder({
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
          {field.label || 'Dropdown'}
        </Label>
        <Select disabled>
          <SelectTrigger className="w-full bg-muted/50">
            <SelectValue placeholder={field.placeholder || 'Select an option'} />
          </SelectTrigger>
        </Select>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default SelectField;
