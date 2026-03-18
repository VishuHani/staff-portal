'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';

/**
 * ToggleField - Toggle switch for yes/no
 */
export function ToggleField({
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
      <div className="flex items-center justify-between">
        <Label
          htmlFor={field.id}
          className={cn(
            'text-sm font-medium cursor-pointer',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label}
        </Label>
        <Switch
          id={field.id}
          checked={(value as boolean) ?? false}
          onCheckedChange={handleCheckedChange}
          onBlur={onBlur}
          disabled={disabled || readOnly}
        />
      </div>
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
 * ToggleFieldBuilder - Builder preview for toggle field
 */
export function ToggleFieldBuilder({
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
      <div className="flex items-center justify-between">
        <Label
          className={cn(
            'text-sm font-medium cursor-pointer',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label || 'Toggle'}
        </Label>
        <Switch disabled />
      </div>
      {field.helpText && (
        <p className="text-sm text-muted-foreground mt-2">{field.helpText}</p>
      )}
    </div>
  );
}

export default ToggleField;
