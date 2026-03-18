'use client';

import * as React from 'react';
import { Separator } from '@/components/ui/separator';
import { BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';

/**
 * DividerField - Visual divider line
 */
export function DividerField() {
  return <Separator className="my-4" />;
}

/**
 * DividerFieldBuilder - Builder preview for divider field
 */
export function DividerFieldBuilder({
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
      <Separator className="my-2" />
      <p className="text-xs text-muted-foreground text-center">Divider</p>
    </div>
  );
}

export default DividerField;
