'use client';

import * as React from 'react';
import { DndProvider, useDrag, useDrop, DropTargetMonitor, DragSourceMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  Calendar,
  Clock,
  ChevronDown,
  List,
  CircleDot,
  CheckSquare,
  ToggleLeft,
  Upload,
  Image,
  PenTool,
  Minus,
  Heading,
  FileText,
  Eye,
  Save,
  Download,
  Undo,
  Redo,
  Trash2,
  Copy,
  GripVertical,
  Plus,
  Menu,
  Play,
  // New icons for advanced fields
  Star,
  Gauge,
  Sliders,
  Calculator,
  DollarSign,
  Percent,
  Link,
  Grid,
  // Phase 6 icons - using different name to avoid conflict
  Copy as CopyIcon,
  FileText as FileTextIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormSchema,
  FormField,
  FieldType,
  FIELD_TYPE_CONFIGS,
  createNewField,
  createNewSchema,
  FieldCategory,
} from '@/lib/types/form-schema';
import {
  TextFieldBuilder,
  TextareaFieldBuilder,
  NumberFieldBuilder,
  EmailFieldBuilder,
  PhoneFieldBuilder,
  DateFieldBuilder,
  TimeFieldBuilder,
  SelectFieldBuilder,
  MultiSelectFieldBuilder,
  RadioFieldBuilder,
  CheckboxFieldBuilder,
  ToggleFieldBuilder,
  FileFieldBuilder,
  ImageFieldBuilder,
  SignatureFieldBuilder,
  DividerFieldBuilder,
  HeaderFieldBuilder,
  ParagraphFieldBuilder,
  // New advanced field types
  RatingFieldBuilder,
  ScaleFieldBuilder,
  SliderFieldBuilder,
  CalculationFieldBuilder,
  CurrencyFieldBuilder,
  PercentageFieldBuilder,
  UrlFieldBuilder,
  MatrixFieldBuilder,
  // Phase 6 field types
  RepeatingSectionBuilder,
  PageBreakBuilder,
} from './index';
import { ConditionalLogicPanel } from './ConditionBuilder';
import {
  RepeatingSectionConfig,
  PageBreakConfig,
} from './RepeatingSection';
import { MatrixFieldConfig } from './MatrixField';
import { FormPreviewModal } from '../form-preview/FormPreviewModal';

// ============================================================================
// ICON MAPPING
// ============================================================================

const FIELD_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  email: Mail,
  phone: Phone,
  date: Calendar,
  time: Clock,
  datetime: Calendar,
  select: ChevronDown,
  multiselect: List,
  radio: CircleDot,
  checkbox: CheckSquare,
  toggle: ToggleLeft,
  file: Upload,
  image: Image,
  signature: PenTool,
  divider: Minus,
  header: Heading,
  paragraph: FileText,
  // New advanced field types
  rating: Star,
  scale: Gauge,
  slider: Sliders,
  calculation: Calculator,
  currency: DollarSign,
  percentage: Percent,
  url: Link,
  matrix: Grid,
  // Phase 6 field types
  repeating_section: CopyIcon,
  page_break: FileTextIcon,
};

// ============================================================================
// DRAG AND DROP TYPES
// ============================================================================

const DRAG_TYPES = {
  FIELD_PALETTE: 'field-palette',
  FIELD_CANVAS: 'field-canvas',
};

interface DragItem {
  type: string;
  fieldType?: FieldType;
  fieldId?: string;
  index?: number;
}

// ============================================================================
// FIELD PALETTE ITEM (Individual draggable field type)
// ============================================================================

interface FieldPaletteItemProps {
  type: FieldType;
  label: string;
  onAddField: (type: FieldType) => void;
}

function FieldPaletteItem({ type, label, onAddField }: FieldPaletteItemProps) {
  const Icon = FIELD_ICONS[type];
  const ref = React.useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: DRAG_TYPES.FIELD_PALETTE,
    item: { type: DRAG_TYPES.FIELD_PALETTE, fieldType: type },
    end: (item: DragItem, monitor: DragSourceMonitor) => {
      // If dropped outside a valid drop target, don't add the field
      // The drop target will handle adding the field
    },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [type]);

  // Connect the drag ref
  React.useEffect(() => {
    if (ref.current) {
      drag(ref.current);
    }
  }, [drag]);

  return (
    <div
      ref={ref}
      onClick={() => onAddField(type)}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-lg border border-dashed",
        "hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors",
        isDragging && "opacity-50 border-primary bg-primary/10"
      )}
    >
      <Icon className="h-5 w-5 text-muted-foreground mb-1" />
      <span className="text-xs text-center">{label}</span>
    </div>
  );
}

// ============================================================================
// FIELD PALETTE COMPONENT
// ============================================================================

interface FieldPaletteProps {
  onAddField: (type: FieldType) => void;
  compact?: boolean;
}

function FieldPalette({ onAddField, compact = false }: FieldPaletteProps) {
  const categories: { key: FieldCategory; label: string }[] = [
    { key: 'input', label: 'Input Fields' },
    { key: 'choice', label: 'Choice Fields' },
    { key: 'upload', label: 'Upload Fields' },
    { key: 'layout', label: 'Layout Elements' },
    { key: 'advanced', label: 'Advanced Fields' },
  ];

  return (
    <div className={cn("h-full", compact && "p-2")}>
      {!compact && (
        <div className="px-3 py-2 border-b">
          <h3 className="text-sm font-medium">Field Types</h3>
        </div>
      )}
      <ScrollArea className={cn("h-full", compact ? "h-[50vh]" : "h-[calc(100%-40px)]")}>
        <div className={cn("space-y-4", compact ? "p-2" : "p-3")}>
          {categories.map((category) => (
            <div key={category.key}>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                {category.label}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(FIELD_TYPE_CONFIGS)
                  .filter((config) => config.category === category.key)
                  .map((config) => (
                    <FieldPaletteItem
                      key={config.type}
                      type={config.type}
                      label={config.label}
                      onAddField={onAddField}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// FORM CANVAS COMPONENT
// ============================================================================

interface FormCanvasProps {
  schema: FormSchema;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  onMoveField: (dragIndex: number, hoverIndex: number) => void;
  onDeleteField: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
  onAddField: (type: FieldType) => void;
}

function FormCanvas({
  schema,
  selectedFieldId,
  onSelectField,
  onMoveField,
  onDeleteField,
  onDuplicateField,
  onAddField,
}: FormCanvasProps) {
  const dropRef = React.useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [DRAG_TYPES.FIELD_PALETTE, DRAG_TYPES.FIELD_CANVAS],
    drop: (item: DragItem, monitor: DropTargetMonitor) => {
      // Handle palette item drop - add new field
      if (item.type === DRAG_TYPES.FIELD_PALETTE && item.fieldType) {
        onAddField(item.fieldType);
        return { added: true };
      }
      // Handle canvas item drop - already moved via hover
      return { moved: true };
    },
    collect: (monitor: DropTargetMonitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [onAddField]);

  // Connect the drop ref
  React.useEffect(() => {
    if (dropRef.current) {
      drop(dropRef.current);
    }
  }, [drop]);

  // Render the appropriate field builder component
  const renderFieldBuilder = (field: FormField, index: number) => {
    const props = {
      field,
      isSelected: selectedFieldId === field.id,
      onSelect: () => onSelectField(field.id),
      onDelete: () => onDeleteField(field.id),
      onDuplicate: () => onDuplicateField(field.id),
    };

    switch (field.type) {
      case 'text':
        return <TextFieldBuilder {...props} />;
      case 'textarea':
        return <TextareaFieldBuilder {...props} />;
      case 'number':
        return <NumberFieldBuilder {...props} />;
      case 'email':
        return <EmailFieldBuilder {...props} />;
      case 'phone':
        return <PhoneFieldBuilder {...props} />;
      case 'date':
        return <DateFieldBuilder {...props} />;
      case 'time':
        return <TimeFieldBuilder {...props} />;
      case 'select':
        return <SelectFieldBuilder {...props} />;
      case 'multiselect':
        return <MultiSelectFieldBuilder {...props} />;
      case 'radio':
        return <RadioFieldBuilder {...props} />;
      case 'checkbox':
        return <CheckboxFieldBuilder {...props} />;
      case 'toggle':
        return <ToggleFieldBuilder {...props} />;
      case 'file':
        return <FileFieldBuilder {...props} />;
      case 'image':
        return <ImageFieldBuilder {...props} />;
      case 'signature':
        return <SignatureFieldBuilder {...props} />;
      case 'divider':
        return <DividerFieldBuilder {...props} />;
      case 'header':
        return <HeaderFieldBuilder {...props} />;
      case 'paragraph':
        return <ParagraphFieldBuilder {...props} />;
      // New advanced field types
      case 'rating':
        return <RatingFieldBuilder {...props} />;
      case 'scale':
        return <ScaleFieldBuilder {...props} />;
      case 'slider':
        return <SliderFieldBuilder {...props} />;
      case 'calculation':
        return <CalculationFieldBuilder {...props} />;
      case 'currency':
        return <CurrencyFieldBuilder {...props} />;
      case 'percentage':
        return <PercentageFieldBuilder {...props} />;
      case 'url':
        return <UrlFieldBuilder {...props} />;
      case 'matrix':
        return <MatrixFieldBuilder {...props} />;
      // Phase 6 field types
      case 'repeating_section':
        return <RepeatingSectionBuilder {...props} />;
      case 'page_break':
        return <PageBreakBuilder {...props} />;
      default:
        return <div>Unknown field type</div>;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between flex-shrink-0">
        <CardTitle className="text-sm font-medium">
          {schema.name || 'Untitled Form'}
        </CardTitle>
        <Badge variant="outline">{schema.fields.length} fields</Badge>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={dropRef}
          className={cn(
            'h-full min-h-[300px] rounded-lg border-2 border-dashed transition-colors overflow-auto',
            isOver && canDrop ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            schema.fields.length === 0 && 'flex items-center justify-center'
          )}
        >
          {schema.fields.length === 0 ? (
            <div className="text-center p-8">
              <GripVertical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag fields from the palette or click to add
              </p>
              <p className="text-xs text-muted-foreground">
                Click any field type on the left to add it here
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {schema.fields.map((field, index) => (
                <FieldCanvasItem
                  key={field.id}
                  field={field}
                  index={index}
                  onMoveField={onMoveField}
                  onSelect={() => onSelectField(field.id)}
                  isSelected={selectedFieldId === field.id}
                >
                  {renderFieldBuilder(field, index)}
                </FieldCanvasItem>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FIELD CANVAS ITEM (for drag and drop reordering)
// ============================================================================

interface FieldCanvasItemProps {
  field: FormField;
  index: number;
  onMoveField: (dragIndex: number, hoverIndex: number) => void;
  onSelect: () => void;
  isSelected: boolean;
  children: React.ReactNode;
}

function FieldCanvasItem({
  field,
  index,
  onMoveField,
  onSelect,
  isSelected,
  children,
}: FieldCanvasItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: DRAG_TYPES.FIELD_CANVAS,
    item: { type: DRAG_TYPES.FIELD_CANVAS, fieldId: field.id, index },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [field.id, index]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: DRAG_TYPES.FIELD_CANVAS,
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!ref.current) return;
      if (item.index === index) return;

      const dragIndex = item.index!;
      const hoverIndex = index;

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onMoveField(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor: DropTargetMonitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [index, onMoveField]);

  // Connect both drag and drop refs
  React.useEffect(() => {
    if (ref.current) {
      drag(drop(ref.current));
    }
  }, [drag, drop]);

  return (
    <div
      ref={ref}
      className={cn(
        'relative group transition-all',
        isDragging && 'opacity-50 scale-[0.98]',
        isOver && 'border-t-2 border-primary pt-2'
      )}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// FIELD CONFIGURATION PANEL
// ============================================================================

interface FieldConfigPanelProps {
  field: FormField | null;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  allFields: FormField[];
}

function FieldConfigPanel({
  field,
  onUpdate,
  onDelete,
  onDuplicate,
  allFields,
}: FieldConfigPanelProps) {
  if (!field) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Menu className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Select a field to configure
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = FIELD_TYPE_CONFIGS[field.type];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between flex-shrink-0">
        <CardTitle className="text-sm font-medium">Field Settings</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onDuplicate} title="Duplicate">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            {/* Basic Settings */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Basic
              </h4>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                />
              </div>

              {config.supportsValidation && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Required</label>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => onUpdate({ required: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Help Text</label>
                <input
                  type="text"
                  value={field.helpText || ''}
                  onChange={(e) => onUpdate({ helpText: e.target.value })}
                  placeholder="Optional help text..."
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Placeholder</label>
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  placeholder="Optional placeholder..."
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                />
              </div>
            </div>

            <Separator />

            {/* Options for select/radio/checkbox */}
            {config.supportsOptions && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Options
                </h4>
                <div className="space-y-2">
                  {(field.options || []).map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...(field.options || [])];
                          newOptions[index] = { ...option, label: e.target.value };
                          onUpdate({ options: newOptions });
                        }}
                        className="flex-1 px-2 py-1 text-sm border rounded bg-background"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOptions = field.options?.filter((_, i) => i !== index);
                          onUpdate({ options: newOptions });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const newOptions = [
                        ...(field.options || []),
                        { value: `option_${Date.now()}`, label: 'New Option' },
                      ];
                      onUpdate({ options: newOptions });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            {/* Number field specific */}
            {field.type === 'number' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Number Settings
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Min</label>
                    <input
                      type="number"
                      value={field.min ?? ''}
                      onChange={(e) => onUpdate({ min: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max</label>
                    <input
                      type="number"
                      value={field.max ?? ''}
                      onChange={(e) => onUpdate({ max: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Step</label>
                  <input
                    type="number"
                    value={field.step ?? 1}
                    onChange={(e) => onUpdate({ step: e.target.value ? Number(e.target.value) : 1 })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  />
                </div>
              </div>
            )}

            {/* Header field specific */}
            {field.type === 'header' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Header Settings
                </h4>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Header Level</label>
                  <select
                    value={field.headerLevel || 2}
                    onChange={(e) => onUpdate({ headerLevel: Number(e.target.value) as 1|2|3|4|5|6 })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  >
                    <option value={1}>H1 - Largest</option>
                    <option value={2}>H2 - Large</option>
                    <option value={3}>H3 - Medium</option>
                    <option value={4}>H4 - Small</option>
                    <option value={5}>H5 - Smaller</option>
                    <option value={6}>H6 - Smallest</option>
                  </select>
                </div>
              </div>
            )}

            {/* Paragraph field specific */}
            {field.type === 'paragraph' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Content
                </h4>
                <textarea
                  value={field.content || ''}
                  onChange={(e) => onUpdate({ content: e.target.value })}
                  placeholder="Enter your text..."
                  className="w-full px-3 py-2 text-sm border rounded-md min-h-[100px] bg-background"
                />
              </div>
            )}

            {/* Rating field specific */}
            {field.type === 'rating' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Rating Settings
                </h4>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Max Rating</label>
                  <select
                    value={field.ratingMax || 5}
                    onChange={(e) => onUpdate({ ratingMax: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={7}>7</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Style</label>
                  <select
                    value={field.ratingStyle || 'stars'}
                    onChange={(e) => onUpdate({ ratingStyle: e.target.value as 'stars' | 'numbers' | 'emojis' | 'hearts' })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  >
                    <option value="stars">Stars</option>
                    <option value="hearts">Hearts</option>
                    <option value="emojis">Emojis</option>
                    <option value="numbers">Numbers</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Low Label</label>
                    <input
                      type="text"
                      value={field.ratingLabels?.low || ''}
                      onChange={(e) => onUpdate({ ratingLabels: { low: e.target.value, high: field.ratingLabels?.high || '' } })}
                      placeholder="Poor"
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">High Label</label>
                    <input
                      type="text"
                      value={field.ratingLabels?.high || ''}
                      onChange={(e) => onUpdate({ ratingLabels: { low: field.ratingLabels?.low || '', high: e.target.value } })}
                      placeholder="Excellent"
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Scale field specific */}
            {field.type === 'scale' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Scale Settings
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Min Value</label>
                    <input
                      type="number"
                      value={field.scaleMin ?? 1}
                      onChange={(e) => onUpdate({ scaleMin: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max Value</label>
                    <input
                      type="number"
                      value={field.scaleMax ?? 10}
                      onChange={(e) => onUpdate({ scaleMax: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Style</label>
                  <select
                    value={field.scaleStyle || 'numbers'}
                    onChange={(e) => onUpdate({ scaleStyle: e.target.value as 'numbers' | 'faces' | 'gradient' })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  >
                    <option value="numbers">Numbers</option>
                    <option value="faces">Faces</option>
                    <option value="gradient">Gradient</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Min Label</label>
                    <input
                      type="text"
                      value={field.scaleMinLabel || ''}
                      onChange={(e) => onUpdate({ scaleMinLabel: e.target.value })}
                      placeholder="Not likely"
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max Label</label>
                    <input
                      type="text"
                      value={field.scaleMaxLabel || ''}
                      onChange={(e) => onUpdate({ scaleMaxLabel: e.target.value })}
                      placeholder="Very likely"
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Slider field specific */}
            {field.type === 'slider' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Slider Settings
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Min Value</label>
                    <input
                      type="number"
                      value={field.sliderMin ?? 0}
                      onChange={(e) => onUpdate({ sliderMin: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max Value</label>
                    <input
                      type="number"
                      value={field.sliderMax ?? 100}
                      onChange={(e) => onUpdate({ sliderMax: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Step</label>
                    <input
                      type="number"
                      value={field.sliderStep ?? 1}
                      onChange={(e) => onUpdate({ sliderStep: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Unit</label>
                    <input
                      type="text"
                      value={field.sliderUnit || ''}
                      onChange={(e) => onUpdate({ sliderUnit: e.target.value })}
                      placeholder="$, %, km..."
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Show Value</label>
                  <input
                    type="checkbox"
                    checked={field.showSliderValue !== false}
                    onChange={(e) => onUpdate({ showSliderValue: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
              </div>
            )}

            {/* Calculation field specific */}
            {field.type === 'calculation' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Calculation Settings
                </h4>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Formula</label>
                  <textarea
                    value={field.formula || ''}
                    onChange={(e) => onUpdate({ formula: e.target.value })}
                    placeholder="e.g., {field_1} * {field_2}"
                    className="w-full px-2 py-1 text-sm font-mono border rounded bg-background min-h-[60px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{field_id}'} to reference other numeric fields.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Display Format</label>
                    <select
                      value={field.displayFormat || 'number'}
                      onChange={(e) => onUpdate({ displayFormat: e.target.value as 'number' | 'currency' | 'percentage' })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    >
                      <option value="number">Number</option>
                      <option value="currency">Currency</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Decimal Places</label>
                    <input
                      type="number"
                      value={field.decimalPlaces ?? 2}
                      onChange={(e) => onUpdate({ decimalPlaces: Number(e.target.value) })}
                      min={0}
                      max={10}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                {field.displayFormat === 'currency' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Currency Symbol</label>
                    <input
                      type="text"
                      value={field.currencySymbol || '$'}
                      onChange={(e) => onUpdate({ currencySymbol: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Currency field specific */}
            {field.type === 'currency' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Currency Settings
                </h4>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Currency Code</label>
                  <select
                    value={field.currencyCode || 'AUD'}
                    onChange={(e) => onUpdate({ currencyCode: e.target.value })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  >
                    <option value="AUD">AUD ($)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CNY">CNY (¥)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="NZD">NZD ($)</option>
                    <option value="SGD">SGD ($)</option>
                    <option value="HKD">HKD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="KRW">KRW (₩)</option>
                    <option value="BRL">BRL (R$)</option>
                    <option value="MXN">MXN ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Min Value</label>
                    <input
                      type="number"
                      value={field.min ?? ''}
                      onChange={(e) => onUpdate({ min: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max Value</label>
                    <input
                      type="number"
                      value={field.max ?? ''}
                      onChange={(e) => onUpdate({ max: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Step</label>
                  <input
                    type="number"
                    value={field.step ?? 0.01}
                    onChange={(e) => onUpdate({ step: e.target.value ? Number(e.target.value) : 0.01 })}
                    step="0.01"
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  />
                </div>
              </div>
            )}

            {/* Percentage field specific */}
            {field.type === 'percentage' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Percentage Settings
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Min Value</label>
                    <input
                      type="number"
                      value={field.min ?? 0}
                      onChange={(e) => onUpdate({ min: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max Value</label>
                    <input
                      type="number"
                      value={field.max ?? 100}
                      onChange={(e) => onUpdate({ max: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Step</label>
                  <input
                    type="number"
                    value={field.step ?? 1}
                    onChange={(e) => onUpdate({ step: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  />
                </div>
              </div>
            )}

            {/* URL field specific */}
            {field.type === 'url' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  URL Settings
                </h4>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Auto-prefix https://</label>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  URLs will be validated and can open in a new tab when clicked.
                </p>
              </div>
            )}

            {/* Matrix field specific */}
            {field.type === 'matrix' && (
              <MatrixFieldConfig
                field={field}
                onUpdate={onUpdate}
              />
            )}

            {/* Repeating Section field specific */}
            {field.type === 'repeating_section' && (
              <RepeatingSectionConfig
                field={field}
                onUpdate={onUpdate}
                allFields={allFields}
              />
            )}

            {/* Page Break field specific */}
            {field.type === 'page_break' && (
              <PageBreakConfig
                field={field}
                onUpdate={onUpdate}
              />
            )}

            {/* Conditional Logic */}
            {config.supportsConditional && allFields.length > 1 && (
              <>
                <Separator />
                <ConditionalLogicPanel
                  field={field}
                  allFields={allFields}
                  onUpdate={onUpdate}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FORM BUILDER MAIN COMPONENT
// ============================================================================

export interface FormBuilderProps {
  initialSchema?: FormSchema;
  onSave?: (schema: FormSchema) => void;
  onExport?: (schema: FormSchema) => void;
}

export function FormBuilder({ initialSchema, onSave, onExport }: FormBuilderProps) {
  const [schema, setSchema] = React.useState<FormSchema>(
    initialSchema || createNewSchema()
  );
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<FormSchema[]>([schema]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const selectedField = schema.fields.find((f) => f.id === selectedFieldId) || null;

  // Add a new field
  const handleAddField = React.useCallback((type: FieldType) => {
    const newField = createNewField(type, schema.fields.length);
    const newSchema = {
      ...schema,
      fields: [...schema.fields, newField],
    };
    updateSchema(newSchema);
    setSelectedFieldId(newField.id);
    setIsMobilePaletteOpen(false); // Close mobile palette after adding
  }, [schema]);

  // Update field
  const handleUpdateField = (updates: Partial<FormField>) => {
    if (!selectedFieldId) return;
    
    const newFields = schema.fields.map((f) =>
      f.id === selectedFieldId ? { ...f, ...updates } : f
    );
    updateSchema({ ...schema, fields: newFields });
  };

  // Delete field
  const handleDeleteField = (fieldId: string) => {
    const newFields = schema.fields.filter((f) => f.id !== fieldId);
    updateSchema({ ...schema, fields: newFields });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  // Duplicate field
  const handleDuplicateField = (fieldId: string) => {
    const field = schema.fields.find((f) => f.id === fieldId);
    if (!field) return;

    const newField: FormField = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `${field.label} (Copy)`,
    };

    const index = schema.fields.findIndex((f) => f.id === fieldId);
    const newFields = [...schema.fields];
    newFields.splice(index + 1, 0, newField);
    
    updateSchema({ ...schema, fields: newFields });
    setSelectedFieldId(newField.id);
  };

  // Move field (reorder)
  const handleMoveField = (dragIndex: number, hoverIndex: number) => {
    const newFields = [...schema.fields];
    const [draggedField] = newFields.splice(dragIndex, 1);
    newFields.splice(hoverIndex, 0, draggedField);
    updateSchema({ ...schema, fields: newFields });
  };

  // Update schema with history tracking
  const updateSchema = (newSchema: FormSchema) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSchema);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSchema(newSchema);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSchema(history[historyIndex - 1]);
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSchema(history[historyIndex + 1]);
    }
  };

  // Export schema
  const handleExport = () => {
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.name.replace(/\s+/g, '_')}_schema.json`;
    a.click();
    URL.revokeObjectURL(url);
    onExport?.(schema);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col bg-background">
        {/* Toolbar */}
        <div className="border-b p-2 flex items-center justify-between bg-background flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex === history.length - 1}
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <input
              type="text"
              value={schema.name}
              onChange={(e) => updateSchema({ ...schema, name: e.target.value })}
              className="px-2 py-1 text-sm font-medium border rounded bg-background w-48"
              placeholder="Form name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsPreviewOpen(true)}
              disabled={schema.fields.length === 0}
            >
              <Play className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => onSave?.(schema)}
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Main Content - Responsive Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-0 lg:gap-0">
            {/* Left Panel - Field Palette (Desktop) */}
            <div className="hidden lg:block border-r overflow-auto">
              <FieldPalette onAddField={handleAddField} />
            </div>

            {/* Center - Form Canvas */}
            <div className="overflow-auto p-4">
              <FormCanvas
                schema={schema}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onMoveField={handleMoveField}
                onDeleteField={handleDeleteField}
                onDuplicateField={handleDuplicateField}
                onAddField={handleAddField}
              />
            </div>

            {/* Right Panel - Field Configuration (Desktop) */}
            <div className="hidden lg:block border-l overflow-auto">
              <FieldConfigPanel
                field={selectedField}
                onUpdate={handleUpdateField}
                onDelete={() => selectedFieldId && handleDeleteField(selectedFieldId)}
                onDuplicate={() => selectedFieldId && handleDuplicateField(selectedFieldId)}
                allFields={schema.fields}
              />
            </div>
          </div>
        </div>

        {/* Mobile Bottom Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-2 flex gap-2 z-50">
          {/* Mobile Field Palette */}
          <Sheet open={isMobilePaletteOpen} onOpenChange={setIsMobilePaletteOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]">
              <SheetHeader>
                <SheetTitle>Add Field</SheetTitle>
              </SheetHeader>
              <FieldPalette onAddField={handleAddField} compact />
            </SheetContent>
          </Sheet>

          {/* Mobile Field Config */}
          {selectedField && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Menu className="h-4 w-4 mr-1" />
                  Configure
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh]">
                <SheetHeader>
                  <SheetTitle>Field Settings</SheetTitle>
                </SheetHeader>
                <FieldConfigPanel
                  field={selectedField}
                  onUpdate={handleUpdateField}
                  onDelete={() => {
                    handleDeleteField(selectedFieldId!);
                  }}
                  onDuplicate={() => handleDuplicateField(selectedFieldId!)}
                  allFields={schema.fields}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Form Preview Modal */}
        <FormPreviewModal
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          schema={schema}
        />
      </div>
    </DndProvider>
  );
}

export default FormBuilder;
