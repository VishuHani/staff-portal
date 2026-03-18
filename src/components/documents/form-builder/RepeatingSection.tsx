'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Copy,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormField,
  FieldType,
  createNewField,
  FIELD_TYPE_CONFIGS,
} from '@/lib/types/form-schema';

// ============================================================================
// REPEATING SECTION ITEM
// ============================================================================

interface RepeatingSectionItemProps {
  index: number;
  fields: FormField[];
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
  showNumbers: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function RepeatingSectionItem({
  index,
  fields,
  data,
  onUpdate,
  onRemove,
  onDuplicate,
  canRemove,
  showNumbers,
  isCollapsed,
  onToggleCollapse,
}: RepeatingSectionItemProps) {
  const updateField = (fieldId: string, value: unknown) => {
    onUpdate({
      ...data,
      [fieldId]: value,
    });
  };

  return (
    <Card className={cn(
      "border-2 transition-all",
      isCollapsed ? "border-dashed" : "border-solid"
    )}>
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          {showNumbers && (
            <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {index + 1}
            </Badge>
          )}
          <CardTitle className="text-sm font-medium">
            Item {index + 1}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {fields.length} fields
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-7 w-7 p-0"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            className="h-7 w-7 p-0"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="py-3 px-4">
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                {renderField(field, data[field.id], (value) => updateField(field.id, value))}
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Simple field renderer for the repeating section
function renderField(
  field: FormField,
  value: unknown,
  onChange: (value: unknown) => void
) {
  const commonClasses = "w-full px-3 py-2 text-sm border rounded-md bg-background";

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={commonClasses}
        />
      );
    case 'number':
    case 'currency':
    case 'percentage':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          className={commonClasses}
        />
      );
    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn(commonClasses, "min-h-[80px]")}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={commonClasses}
        />
      );
    case 'time':
      return (
        <input
          type="time"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={commonClasses}
        />
      );
    case 'select':
      return (
        <select
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={commonClasses}
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'checkbox':
    case 'toggle':
      return (
        <input
          type="checkbox"
          checked={(value as boolean) || false}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
      );
    default:
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={commonClasses}
        />
      );
  }
}

// ============================================================================
// REPEATING SECTION BUILDER (for Form Builder)
// ============================================================================

export interface RepeatingSectionBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function RepeatingSectionBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: RepeatingSectionBuilderProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "border-2 rounded-lg p-4 cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-muted-foreground/30 bg-background"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{field.label}</span>
          <Badge variant="outline" className="text-xs">
            {field.repeatingFields?.length || 0} fields per item
          </Badge>
          {field.required && (
            <Badge variant="destructive" className="text-xs">Required</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="h-7 w-7 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="h-7 w-7 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          <div className="text-sm text-muted-foreground mb-2">
            Min items: {field.minItems ?? 0} | Max items: {field.maxItems ?? 10}
          </div>
          {field.repeatingFields && field.repeatingFields.length > 0 ? (
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Fields in each item:
              </div>
              <div className="space-y-1">
                {field.repeatingFields.map((f, idx) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-background"
                  >
                    <Badge variant="secondary" className="text-xs">
                      {idx + 1}
                    </Badge>
                    <span>{f.label}</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {f.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic border rounded-lg p-3 bg-muted/30">
              No fields added yet. Add fields in the configuration panel.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PAGE BREAK BUILDER (for Form Builder)
// ============================================================================

export interface PageBreakBuilderProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function PageBreakBuilder({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: PageBreakBuilderProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-muted-foreground/50" />
          <span className="text-sm font-medium text-muted-foreground">
            Page Break
          </span>
          <div className="h-px w-8 bg-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="h-7 w-7 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {(field.pageTitle || field.pageDescription) && (
        <div className="mt-3 text-center">
          {field.pageTitle && (
            <div className="text-sm font-medium">{field.pageTitle}</div>
          )}
          {field.pageDescription && (
            <div className="text-xs text-muted-foreground mt-1">
              {field.pageDescription}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REPEATING SECTION RENDERER (for Form Preview/Rendering)
// ============================================================================

export interface RepeatingSectionRendererProps {
  field: FormField;
  value: Record<string, unknown>[];
  onChange: (value: Record<string, unknown>[]) => void;
  error?: string;
}

export function RepeatingSectionRenderer({
  field,
  value,
  onChange,
  error,
}: RepeatingSectionRendererProps) {
  const [collapsedItems, setCollapsedItems] = React.useState<Set<number>>(new Set());
  const items = Array.isArray(value) ? value : [];
  const minItems = field.minItems ?? 0;
  const maxItems = field.maxItems ?? 10;
  const canAdd = items.length < maxItems;
  const canRemove = items.length > minItems;

  const addItem = () => {
    if (!canAdd) return;
    const newItem: Record<string, unknown> = {};
    // Initialize with default values
    field.repeatingFields?.forEach((f) => {
      if (f.defaultValue !== undefined) {
        newItem[f.id] = f.defaultValue;
      }
    });
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (!canRemove) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const duplicateItem = (index: number) => {
    if (!canAdd) return;
    const newItem = { ...items[index] };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, data: Record<string, unknown>) => {
    const newItems = [...items];
    newItems[index] = data;
    onChange(newItems);
  };

  const toggleCollapse = (index: number) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {field.helpText && (
            <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
          )}
        </div>
        <Badge variant="outline">
          {items.length} / {maxItems} items
        </Badge>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <RepeatingSectionItem
            key={index}
            index={index}
            fields={field.repeatingFields || []}
            data={item}
            onUpdate={(data) => updateItem(index, data)}
            onRemove={() => removeItem(index)}
            onDuplicate={() => duplicateItem(index)}
            canRemove={canRemove}
            showNumbers={field.showItemNumbers !== false}
            isCollapsed={collapsedItems.has(index)}
            onToggleCollapse={() => toggleCollapse(index)}
          />
        ))}
      </div>

      {canAdd && (
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {field.addButtonText || 'Add Item'}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// REPEATING SECTION CONFIG PANEL
// ============================================================================

export interface RepeatingSectionConfigProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  allFields: FormField[];
}

export function RepeatingSectionConfig({
  field,
  onUpdate,
  allFields,
}: RepeatingSectionConfigProps) {
  const [newFieldType, setNewFieldType] = React.useState<FieldType>('text');

  const addFieldToSection = () => {
    const newField = createNewField(newFieldType, 0);
    const currentFields = field.repeatingFields || [];
    onUpdate({
      repeatingFields: [...currentFields, newField],
    });
  };

  const removeFieldFromSection = (fieldId: string) => {
    const currentFields = field.repeatingFields || [];
    onUpdate({
      repeatingFields: currentFields.filter((f) => f.id !== fieldId),
    });
  };

  const updateChildField = (fieldId: string, updates: Partial<FormField>) => {
    const currentFields = field.repeatingFields || [];
    onUpdate({
      repeatingFields: currentFields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  return (
    <div className="space-y-4">
      {/* Section Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">
          Section Settings
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Min Items</label>
            <input
              type="number"
              value={field.minItems ?? 0}
              onChange={(e) => onUpdate({ minItems: Number(e.target.value) })}
              min={0}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Max Items</label>
            <input
              type="number"
              value={field.maxItems ?? 10}
              onChange={(e) => onUpdate({ maxItems: Number(e.target.value) })}
              min={1}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Add Button Text</label>
          <input
            type="text"
            value={field.addButtonText || ''}
            onChange={(e) => onUpdate({ addButtonText: e.target.value })}
            placeholder="Add Item"
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Remove Button Text</label>
          <input
            type="text"
            value={field.removeButtonText || ''}
            onChange={(e) => onUpdate({ removeButtonText: e.target.value })}
            placeholder="Remove"
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Show Item Numbers</label>
          <input
            type="checkbox"
            checked={field.showItemNumbers !== false}
            onChange={(e) => onUpdate({ showItemNumbers: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
      </div>

      {/* Fields in Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">
          Fields in Each Item
        </h4>
        
        {field.repeatingFields && field.repeatingFields.length > 0 ? (
          <div className="space-y-2">
            {field.repeatingFields.map((childField, index) => (
              <div
                key={childField.id}
                className="flex items-center gap-2 p-2 border rounded bg-background"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <Badge variant="secondary" className="text-xs">
                  {index + 1}
                </Badge>
                <input
                  type="text"
                  value={childField.label}
                  onChange={(e) =>
                    updateChildField(childField.id, { label: e.target.value })
                  }
                  className="flex-1 px-2 py-1 text-sm border-0 bg-transparent focus:ring-0"
                />
                <Badge variant="outline" className="text-xs">
                  {childField.type}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFieldFromSection(childField.id)}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic p-3 border rounded bg-muted/30">
            No fields added yet
          </div>
        )}

        {/* Add Field */}
        <div className="flex gap-2">
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            className="flex-1 px-2 py-1 text-sm border rounded bg-background"
          >
            {Object.values(FIELD_TYPE_CONFIGS)
              .filter((c) => c.category !== 'layout') // Exclude layout fields
              .map((config) => (
                <option key={config.type} value={config.type}>
                  {config.label}
                </option>
              ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addFieldToSection}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE BREAK CONFIG PANEL
// ============================================================================

export interface PageBreakConfigProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function PageBreakConfig({
  field,
  onUpdate,
}: PageBreakConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">
          Next Page Settings
        </h4>
        <div className="space-y-1">
          <label className="text-xs font-medium">Page Title</label>
          <input
            type="text"
            value={field.pageTitle || ''}
            onChange={(e) => onUpdate({ pageTitle: e.target.value })}
            placeholder="Enter page title..."
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Page Description</label>
          <textarea
            value={field.pageDescription || ''}
            onChange={(e) => onUpdate({ pageDescription: e.target.value })}
            placeholder="Enter page description..."
            className="w-full px-2 py-1 text-sm border rounded bg-background min-h-[60px]"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The page break creates a new page in multi-page forms. Fields after this
        break will appear on the next page.
      </p>
    </div>
  );
}

export default RepeatingSectionRenderer;