'use client';

import * as React from 'react';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronDown, 
  ChevronUp,
  Copy,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FormField,
  FormSchema,
  Condition,
  ConditionGroup,
  ConditionalLogic,
  ConditionOperator,
  ConditionalAction,
  ConditionOperatorType,
} from '@/lib/types/form-schema';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let conditionIdCounter = 0;
const generateConditionId = () => `cond_${Date.now()}_${conditionIdCounter++}`;
const generateGroupId = () => `group_${Date.now()}_${conditionIdCounter++}`;

export function createEmptyCondition(fieldId?: string): Condition {
  return {
    id: generateConditionId(),
    fieldId: fieldId || '',
    operator: 'equals',
    value: '',
  };
}

export function createEmptyConditionGroup(): ConditionGroup {
  return {
    id: generateGroupId(),
    operator: 'and',
    conditions: [createEmptyCondition()],
  };
}

export function createEmptyConditionalLogic(): ConditionalLogic {
  return {
    id: `cl_${Date.now()}`,
    action: 'show',
    conditionGroups: [createEmptyConditionGroup()],
  };
}

// Get operators applicable to a field type
export function getOperatorsForFieldType(fieldType: string): { value: ConditionOperator; label: string }[] {
  const commonOperators = [
    { value: 'equals' as ConditionOperator, label: 'Equals' },
    { value: 'not_equals' as ConditionOperator, label: 'Not equals' },
    { value: 'is_empty' as ConditionOperator, label: 'Is empty' },
    { value: 'is_not_empty' as ConditionOperator, label: 'Is not empty' },
  ];
  
  const textOperators = [
    { value: 'contains' as ConditionOperator, label: 'Contains' },
    { value: 'not_contains' as ConditionOperator, label: 'Does not contain' },
    { value: 'starts_with' as ConditionOperator, label: 'Starts with' },
    { value: 'ends_with' as ConditionOperator, label: 'Ends with' },
    { value: 'matches_regex' as ConditionOperator, label: 'Matches pattern' },
    { value: 'length_equals' as ConditionOperator, label: 'Length equals' },
    { value: 'length_greater' as ConditionOperator, label: 'Length greater than' },
    { value: 'length_less' as ConditionOperator, label: 'Length less than' },
  ];
  
  const numberOperators = [
    { value: 'greater_than' as ConditionOperator, label: 'Greater than' },
    { value: 'less_than' as ConditionOperator, label: 'Less than' },
    { value: 'greater_than_or_equal' as ConditionOperator, label: 'Greater or equal' },
    { value: 'less_than_or_equal' as ConditionOperator, label: 'Less or equal' },
    { value: 'is_between' as ConditionOperator, label: 'Is between' },
  ];
  
  const dateOperators = [
    { value: 'is_before' as ConditionOperator, label: 'Is before' },
    { value: 'is_after' as ConditionOperator, label: 'Is after' },
    { value: 'is_date_between' as ConditionOperator, label: 'Is between' },
    { value: 'is_today' as ConditionOperator, label: 'Is today' },
    { value: 'is_in_past' as ConditionOperator, label: 'Is in past' },
    { value: 'is_in_future' as ConditionOperator, label: 'Is in future' },
  ];
  
  const multiSelectOperators = [
    { value: 'has_any_of' as ConditionOperator, label: 'Has any of' },
    { value: 'has_all_of' as ConditionOperator, label: 'Has all of' },
    { value: 'has_none_of' as ConditionOperator, label: 'Has none of' },
    { value: 'is_one_of' as ConditionOperator, label: 'Is one of' },
    { value: 'is_not_one_of' as ConditionOperator, label: 'Is not one of' },
  ];
  
  switch (fieldType) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
      return [...commonOperators, ...textOperators];
    case 'number':
    case 'rating':
    case 'scale':
    case 'slider':
    case 'calculation':
    case 'currency':
    case 'percentage':
      return [...commonOperators, ...numberOperators];
    case 'date':
    case 'datetime':
      return [...commonOperators, ...dateOperators];
    case 'select':
    case 'radio':
      return [...commonOperators, ...multiSelectOperators.slice(3)];
    case 'multiselect':
    case 'checkbox':
      return [...commonOperators, ...multiSelectOperators];
    default:
      return commonOperators;
  }
}

// Check if operator needs a value input
export function operatorNeedsValue(operator: ConditionOperator): boolean {
  const noValueOperators = ['is_empty', 'is_not_empty', 'is_today', 'is_in_past', 'is_in_future'];
  return !noValueOperators.includes(operator);
}

// Check if operator needs two values (between)
export function operatorNeedsTwoValues(operator: ConditionOperator): boolean {
  return operator === 'is_between' || operator === 'is_date_between';
}

// ============================================================================
// CONDITION ROW COMPONENT
// ============================================================================

interface ConditionRowProps {
  condition: Condition;
  fields: FormField[];
  currentFieldId: string;
  onUpdate: (condition: Condition) => void;
  onDelete: () => void;
  isFirst: boolean;
}

function ConditionRow({
  condition,
  fields,
  currentFieldId,
  onUpdate,
  onDelete,
  isFirst,
}: ConditionRowProps) {
  const selectedField = fields.find(f => f.id === condition.fieldId);
  const operators = selectedField ? getOperatorsForFieldType(selectedField.type) : [];
  
  const handleFieldChange = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    const newOperators = field ? getOperatorsForFieldType(field.type) : [];
    const needsValue = newOperators.length > 0 ? operatorNeedsValue(newOperators[0].value) : true;
    
    onUpdate({
      ...condition,
      fieldId,
      operator: newOperators[0]?.value || 'equals',
      value: needsValue ? '' : undefined,
      valueEnd: undefined,
    });
  };
  
  const handleOperatorChange = (operator: ConditionOperator) => {
    const needsValue = operatorNeedsValue(operator);
    const needsTwo = operatorNeedsTwoValues(operator);
    
    onUpdate({
      ...condition,
      operator,
      value: needsValue ? (condition.value || '') : undefined,
      valueEnd: needsTwo ? (condition.valueEnd || '') : undefined,
    });
  };
  
  return (
    <div className="rounded-lg border bg-muted/30 p-2 sm:p-3">
      {/* Mobile: AND connector badge on separate line */}
      {!isFirst && (
        <div className="mb-2 sm:hidden">
          <Badge variant="outline" className="text-xs">
            AND
          </Badge>
        </div>
      )}
      
      {/* Main row - responsive flex layout */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* First row on mobile: AND badge + Field selector */}
        <div className="flex items-center gap-2 flex-1">
          {/* Desktop: AND connector badge inline */}
          {!isFirst && (
            <Badge variant="outline" className="hidden sm:block shrink-0 text-xs">
              AND
            </Badge>
          )}
          
          {/* Field selector */}
          <Select value={condition.fieldId} onValueChange={handleFieldChange}>
            <SelectTrigger className="flex-1 sm:w-[140px] lg:w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {fields
                .filter(f => f.id !== currentFieldId)
                .map(field => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Second row on mobile: Operator + Value(s) */}
        <div className="flex flex-col xs:flex-row xs:items-center gap-2 flex-1">
          {/* Operator selector */}
          <Select 
            value={condition.operator} 
            onValueChange={(v) => handleOperatorChange(v as ConditionOperator)}
            disabled={!condition.fieldId}
          >
            <SelectTrigger className="flex-1 xs:w-[120px] lg:w-[140px] h-8 text-xs">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {operators.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Value input(s) */}
          {condition.fieldId && operatorNeedsValue(condition.operator) && (
            <div className="flex items-center gap-2 flex-1">
              <Input
                type={selectedField?.type === 'number' || selectedField?.type === 'rating' || selectedField?.type === 'scale' || selectedField?.type === 'slider' ? 'number' : 'text'}
                value={condition.value as string || ''}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                className="flex-1 xs:w-[100px] lg:w-[120px] h-8 text-xs"
                placeholder="Value"
              />
              {operatorNeedsTwoValues(condition.operator) && (
                <>
                  <span className="text-xs text-muted-foreground shrink-0">and</span>
                  <Input
                    type={selectedField?.type === 'number' || selectedField?.type === 'date' ? selectedField.type : 'text'}
                    value={condition.valueEnd as string || ''}
                    onChange={(e) => onUpdate({ ...condition, valueEnd: e.target.value })}
                    className="flex-1 xs:w-[100px] lg:w-[120px] h-8 text-xs"
                    placeholder="End value"
                  />
                </>
              )}
            </div>
          )}
          
          {/* Delete button - always visible on mobile, hover on desktop */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0 self-end xs:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONDITION GROUP COMPONENT
// ============================================================================

interface ConditionGroupBuilderProps {
  group: ConditionGroup;
  fields: FormField[];
  currentFieldId: string;
  onUpdate: (group: ConditionGroup) => void;
  onDelete: () => void;
  depth?: number;
}

function ConditionGroupBuilder({
  group,
  fields,
  currentFieldId,
  onUpdate,
  onDelete,
  depth = 0,
}: ConditionGroupBuilderProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const handleOperatorChange = (operator: ConditionOperatorType) => {
    onUpdate({ ...group, operator });
  };
  
  const handleConditionUpdate = (index: number, updatedCondition: Condition) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updatedCondition;
    onUpdate({ ...group, conditions: newConditions });
  };
  
  const handleConditionDelete = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onDelete();
    } else {
      onUpdate({ ...group, conditions: newConditions });
    }
  };
  
  const handleAddCondition = () => {
    const newCondition = createEmptyCondition();
    onUpdate({ ...group, conditions: [...group.conditions, newCondition] });
  };
  
  const handleAddGroup = () => {
    const newGroup = createEmptyConditionGroup();
    onUpdate({ ...group, conditions: [...group.conditions, newGroup] });
  };
  
  const handleChildGroupUpdate = (index: number, updatedGroup: ConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updatedGroup;
    onUpdate({ ...group, conditions: newConditions });
  };
  
  const handleChildGroupDelete = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onDelete();
    } else {
      onUpdate({ ...group, conditions: newConditions });
    }
  };
  
  const conditionCount = group.conditions.length;
  
  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      depth === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-background"
    )}>
      {/* Group header - responsive layout */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between p-2 sm:p-3 border-b bg-muted/30 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0 shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          <span className="text-xs font-medium">
            {conditionCount} condition{conditionCount !== 1 ? 's' : ''}
          </span>
          
          {/* Operator toggle - responsive */}
          <div className="flex items-center gap-1">
            <Button
              variant={group.operator === 'and' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleOperatorChange('and')}
              className="h-6 px-2 text-xs"
            >
              ALL
            </Button>
            <Button
              variant={group.operator === 'or' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleOperatorChange('or')}
              className="h-6 px-2 text-xs"
            >
              ANY
            </Button>
          </div>
          
          <span className="text-xs text-muted-foreground hidden sm:inline">
            must be true
          </span>
        </div>
        
        {depth > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0 self-end xs:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      {/* Conditions */}
      {isExpanded && (
        <div className="p-2 sm:p-3 space-y-2">
          {group.conditions.map((condition, index) => (
            'fieldId' in condition ? (
              <ConditionRow
                key={condition.id}
                condition={condition}
                fields={fields}
                currentFieldId={currentFieldId}
                onUpdate={(c) => handleConditionUpdate(index, c)}
                onDelete={() => handleConditionDelete(index)}
                isFirst={index === 0}
              />
            ) : (
              <ConditionGroupBuilder
                key={condition.id}
                group={condition}
                fields={fields}
                currentFieldId={currentFieldId}
                onUpdate={(g) => handleChildGroupUpdate(index, g)}
                onDelete={() => handleChildGroupDelete(index)}
                depth={depth + 1}
              />
            )
          ))}
          
          {/* Add buttons - responsive */}
          <div className="flex flex-col xs:flex-row gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCondition}
              className="h-8 text-xs flex-1 xs:flex-none"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Condition
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddGroup}
              className="h-8 text-xs flex-1 xs:flex-none"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONDITIONAL LOGIC BUILDER COMPONENT
// ============================================================================

interface ConditionalLogicBuilderProps {
  conditionalLogic: ConditionalLogic | undefined;
  fields: FormField[];
  currentFieldId: string;
  onUpdate: (logic: ConditionalLogic) => void;
  onRemove: () => void;
}

export function ConditionalLogicBuilder({
  conditionalLogic,
  fields,
  currentFieldId,
  onUpdate,
  onRemove,
}: ConditionalLogicBuilderProps) {
  const logic = conditionalLogic || createEmptyConditionalLogic();
  
  const handleActionChange = (action: ConditionalAction) => {
    onUpdate({ ...logic, action });
  };
  
  const handleGroupUpdate = (index: number, group: ConditionGroup) => {
    const newGroups = [...logic.conditionGroups];
    newGroups[index] = group;
    onUpdate({ ...logic, conditionGroups: newGroups });
  };
  
  const handleGroupDelete = (index: number) => {
    const newGroups = logic.conditionGroups.filter((_, i) => i !== index);
    if (newGroups.length === 0) {
      onRemove();
    } else {
      onUpdate({ ...logic, conditionGroups: newGroups });
    }
  };
  
  const handleAddGroup = () => {
    const newGroup = createEmptyConditionGroup();
    onUpdate({ ...logic, conditionGroups: [...logic.conditionGroups, newGroup] });
  };
  
  return (
    <div className="space-y-3">
      {/* Action selector - responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Select value={logic.action} onValueChange={(v) => handleActionChange(v as ConditionalAction)}>
          <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="show">Show this field</SelectItem>
            <SelectItem value="hide">Hide this field</SelectItem>
            <SelectItem value="require">Make required</SelectItem>
            <SelectItem value="disable">Disable this field</SelectItem>
            <SelectItem value="set_value">Set value to</SelectItem>
            <SelectItem value="clear_value">Clear value</SelectItem>
            <SelectItem value="skip_to">Skip to field</SelectItem>
            <SelectItem value="show_message">Show message</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Additional value input for certain actions */}
        {logic.action === 'set_value' && (
          <Input
            value={logic.valueToSet as string || ''}
            onChange={(e) => onUpdate({ ...logic, valueToSet: e.target.value })}
            className="w-full sm:w-[150px] h-8 text-xs"
            placeholder="Value"
          />
        )}
        
        {logic.action === 'show_message' && (
          <Input
            value={logic.message || ''}
            onChange={(e) => onUpdate({ ...logic, message: e.target.value })}
            className="flex-1 h-8 text-xs"
            placeholder="Message to display"
          />
        )}
        
        {logic.action === 'skip_to' && (
          <Select 
            value={logic.targetFieldId || ''} 
            onValueChange={(v) => onUpdate({ ...logic, targetFieldId: v })}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {fields
                .filter(f => f.id !== currentFieldId)
                .map(field => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Condition groups */}
      <div className="space-y-2">
        {logic.conditionGroups.map((group, index) => (
          <div key={group.id}>
            {index > 0 && (
              <div className="flex items-center justify-center py-1">
                <Badge variant="secondary" className="text-xs">OR</Badge>
              </div>
            )}
            <ConditionGroupBuilder
              group={group}
              fields={fields}
              currentFieldId={currentFieldId}
              onUpdate={(g) => handleGroupUpdate(index, g)}
              onDelete={() => handleGroupDelete(index)}
            />
          </div>
        ))}
      </div>
      
      {/* Add OR group button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddGroup}
        className="w-full h-8 text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add OR Group
      </Button>
    </div>
  );
}

// ============================================================================
// CONDITIONAL LOGIC PANEL (for FieldConfigPanel)
// ============================================================================

interface ConditionalLogicPanelProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
}

export function ConditionalLogicPanel({
  field,
  allFields,
  onUpdate,
}: ConditionalLogicPanelProps) {
  const [isEnabled, setIsEnabled] = React.useState(!!field.conditionalLogic);
  
  const handleEnable = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled && !field.conditionalLogic) {
      onUpdate({ conditionalLogic: createEmptyConditionalLogic() });
    } else if (!enabled) {
      onUpdate({ conditionalLogic: undefined });
    }
  };
  
  return (
    <div className="space-y-3">
      {/* Header - responsive */}
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5" />
          Conditional Logic
        </h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-muted-foreground">Enable</span>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => handleEnable(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        </label>
      </div>
      
      {!isEnabled && (
        <p className="text-xs text-muted-foreground">
          Show, hide, or modify this field based on conditions.
        </p>
      )}
      
      {isEnabled && field.conditionalLogic && (
        <ConditionalLogicBuilder
          conditionalLogic={field.conditionalLogic}
          fields={allFields}
          currentFieldId={field.id}
          onUpdate={(logic) => onUpdate({ conditionalLogic: logic })}
          onRemove={() => handleEnable(false)}
        />
      )}
    </div>
  );
}

export default ConditionalLogicBuilder;
