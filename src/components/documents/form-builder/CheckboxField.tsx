'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';

/**
 * CheckboxField - Single checkbox
 */
export function CheckboxField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const handleCheckedChange = (checked: boolean) => {
    onChange(checked);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={field.id}
          checked={(value as boolean) ?? false}
          onCheckedChange={handleCheckedChange}
          onBlur={onBlur}
          disabled={disabled || readOnly}
          className={cn(error && 'border-destructive')}
        />
        <Label
          htmlFor={field.id}
          className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label}
        </Label>
      </div>
      {field.helpText && (
        <p className="text-sm text-muted-foreground ml-6">{field.helpText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive ml-6">{error.message}</p>
      )}
    </div>
  );
}

/**
 * CheckboxFieldBuilder - Builder preview for checkbox field
 */
export function CheckboxFieldBuilder({
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
      <div className="flex items-center space-x-2">
        <Checkbox id={`preview-${field.id}`} disabled />
        <Label
          htmlFor={`preview-${field.id}`}
          className={cn(
            'text-sm font-medium leading-none cursor-pointer',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label || 'Checkbox'}
        </Label>
      </div>
      {field.helpText && (
        <p className="text-sm text-muted-foreground ml-6 mt-2">{field.helpText}</p>
      )}
    </div>
  );
}

export default CheckboxField;
