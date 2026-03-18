'use client';

import * as React from 'react';
import { BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

/**
 * HeaderField - Section header
 */
export function HeaderField({ field }: { field: FormField }) {
  const level = field.headerLevel || 2;
  
  const headingClasses: Record<number, string> = {
    1: 'text-3xl font-bold',
    2: 'text-2xl font-semibold',
    3: 'text-xl font-semibold',
    4: 'text-lg font-medium',
    5: 'text-base font-medium',
    6: 'text-sm font-medium',
  };

  const className = cn(headingClasses[level], 'text-foreground');
  
  switch (level) {
    case 1:
      return <h1 className={className}>{field.label}</h1>;
    case 2:
      return <h2 className={className}>{field.label}</h2>;
    case 3:
      return <h3 className={className}>{field.label}</h3>;
    case 4:
      return <h4 className={className}>{field.label}</h4>;
    case 5:
      return <h5 className={className}>{field.label}</h5>;
    case 6:
      return <h6 className={className}>{field.label}</h6>;
    default:
      return <h2 className={className}>{field.label}</h2>;
  }
}

/**
 * HeaderFieldBuilder - Builder preview for header field
 */
export function HeaderFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
}: BuilderFieldProps) {
  const level = field.headerLevel || 2;
  
  const headingClasses: Record<number, string> = {
    1: 'text-3xl font-bold',
    2: 'text-2xl font-semibold',
    3: 'text-xl font-semibold',
    4: 'text-lg font-medium',
    5: 'text-base font-medium',
    6: 'text-sm font-medium',
  };

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
      <div className={cn(headingClasses[level], 'text-foreground')}>
        {field.label || 'Section Header'}
      </div>
    </div>
  );
}

export default HeaderField;
