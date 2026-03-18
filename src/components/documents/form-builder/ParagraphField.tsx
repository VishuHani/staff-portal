'use client';

import * as React from 'react';
import { BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { FormField } from '@/lib/types/form-schema';

/**
 * ParagraphField - Informational text block
 */
export function ParagraphField({ field }: { field: FormField }) {
  return (
    <p className="text-sm text-muted-foreground leading-relaxed">
      {field.content || field.description || ''}
    </p>
  );
}

/**
 * ParagraphFieldBuilder - Builder preview for paragraph field
 */
export function ParagraphFieldBuilder({
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
      <p className="text-sm text-muted-foreground leading-relaxed">
        {field.content || field.description || 'This is an informational text block. Use it to provide instructions or context to users.'}
      </p>
    </div>
  );
}

export default ParagraphField;
