'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';

/**
 * MultiSelectField - Multi-select dropdown
 */
export function MultiSelectField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selectedValues = (value as string[]) ?? [];

  const handleSelect = (selectedValue: string) => {
    const newValues = selectedValues.includes(selectedValue)
      ? selectedValues.filter((v) => v !== selectedValue)
      : [...selectedValues, selectedValue];
    onChange(newValues);
  };

  const handleRemove = (valueToRemove: string) => {
    onChange(selectedValues.filter((v) => v !== valueToRemove));
  };

  const selectedLabels = field.options
    ?.filter((opt) => selectedValues.includes(opt.value))
    .map((opt) => opt.label);

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
            role="combobox"
            aria-expanded={open}
            disabled={disabled || readOnly}
            className={cn(
              'w-full justify-between h-auto min-h-9',
              error && 'border-destructive'
            )}
            onBlur={onBlur}
          >
            {selectedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedLabels?.map((label, index) => (
                  <Badge key={selectedValues[index]} variant="secondary" className="mr-1">
                    {label}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">
                {field.placeholder || 'Select options...'}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {field.options?.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    disabled={option.disabled}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedValues.includes(option.value)
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
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
 * MultiSelectFieldBuilder - Builder preview for multi-select field
 */
export function MultiSelectFieldBuilder({
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
          {field.label || 'Multi-Select'}
        </Label>
        <Button
          variant="outline"
          disabled
          className="w-full justify-between bg-muted/50"
        >
          <span className="text-muted-foreground">
            {field.placeholder || 'Select options...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default MultiSelectField;
