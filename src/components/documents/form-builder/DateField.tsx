'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

/**
 * DateField - Date picker with calendar
 */
export function DateField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const [open, setOpen] = React.useState(false);
  const dateValue = value ? new Date(value as string) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date.toISOString());
    } else {
      onChange(null);
    }
    setOpen(false);
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || readOnly}
            className={cn(
              'w-full justify-start text-left font-normal',
              !dateValue && 'text-muted-foreground',
              error && 'border-destructive'
            )}
            onBlur={onBlur}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateValue ? format(dateValue, 'PPP') : field.placeholder || 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            disabled={(date) => {
              if (field.minDate && date < new Date(field.minDate)) return true;
              if (field.maxDate && date > new Date(field.maxDate)) return true;
              return false;
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
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
 * DateFieldBuilder - Builder preview for date field
 */
export function DateFieldBuilder({
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
          {field.label || 'Date'}
        </Label>
        <Button
          variant="outline"
          disabled
          className="w-full justify-start text-left font-normal bg-muted/50"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {field.placeholder || 'Pick a date'}
        </Button>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default DateField;
