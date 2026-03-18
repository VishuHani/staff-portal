'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';

/**
 * RadioField - Radio button group
 */
export function RadioField({
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
        className={cn(
          'text-sm font-medium',
          field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
        )}
      >
        {field.label}
      </Label>
      <RadioGroup
        value={(value as string) ?? ''}
        onValueChange={handleValueChange}
        disabled={disabled || readOnly}
        onBlur={onBlur}
        className={cn('space-y-2', error && 'text-destructive')}
      >
        {field.options?.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.value}
              id={`${field.id}-${option.value}`}
              disabled={option.disabled}
            />
            <Label
              htmlFor={`${field.id}-${option.value}`}
              className="font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
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
 * RadioFieldBuilder - Builder preview for radio field
 */
export function RadioFieldBuilder({
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
          {field.label || 'Radio Buttons'}
        </Label>
        <RadioGroup disabled className="space-y-2">
          {(field.options?.slice(0, 3) || [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
            { value: 'option3', label: 'Option 3' },
          ]).map((option, index) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`preview-${field.id}-${index}`} />
              <Label htmlFor={`preview-${field.id}-${index}`} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default RadioField;
