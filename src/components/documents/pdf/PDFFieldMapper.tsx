'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Settings,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ExtractedPDFField,
  PDFFieldMapping,
  PrefillSource,
  FieldTransform,
  getAvailablePrefillSources,
  getPrefillSourceDisplayName,
  mapPDFFieldTypeToFormFieldType,
} from '@/lib/documents/pdf-types';

/**
 * Props for the PDFFieldMapper component
 */
interface PDFFieldMapperProps {
  /** Extracted PDF fields */
  fields: ExtractedPDFField[];
  /** Existing field mappings (for editing) */
  existingMappings?: PDFFieldMapping[];
  /** Called when mappings are saved */
  onSave: (mappings: PDFFieldMapping[]) => void | Promise<void>;
  /** Called when mapping is cancelled */
  onCancel?: () => void;
  /** Whether the mapper is in read-only mode */
  readOnly?: boolean;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Transform options
 */
const TRANSFORM_OPTIONS: Array<{ value: FieldTransform['type']; label: string; description: string }> = [
  { value: 'uppercase', label: 'Uppercase', description: 'Convert to uppercase' },
  { value: 'lowercase', label: 'Lowercase', description: 'Convert to lowercase' },
  { value: 'capitalize', label: 'Capitalize', description: 'Capitalize first letter of each word' },
  { value: 'date_format', label: 'Date Format', description: 'Format date values' },
  { value: 'phone_format', label: 'Phone Format', description: 'Format phone numbers' },
];

/**
 * PDF Field Mapper Component
 * 
 * Provides UI for mapping PDF form fields to system fields:
 * - Display extracted fields
 * - Map PDF fields to system fields
 * - Configure prefill sources
 * - Preview mapped fields
 * - Save field mapping configuration
 */
export function PDFFieldMapper({
  fields,
  existingMappings = [],
  onSave,
  onCancel,
  readOnly = false,
  isSaving = false,
  className,
}: PDFFieldMapperProps) {
  // Initialize mappings from existing or create new
  const [mappings, setMappings] = useState<PDFFieldMapping[]>(() => {
    if (existingMappings.length > 0) {
      return existingMappings;
    }
    
    return fields.map((field, index) => ({
      id: `mapping_${field.id}`,
      pdfFieldName: field.name,
      isActive: field.isFillable,
      order: index,
    }));
  });
  
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  
  // Available prefill sources
  const prefillSources = useMemo(() => getAvailablePrefillSources(), []);
  
  // Group fields by type
  const fieldsByType = useMemo(() => {
    const groups: Record<string, ExtractedPDFField[]> = {};
    
    for (const field of fields) {
      const type = field.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(field);
    }
    
    return groups;
  }, [fields]);
  
  // Get mapping for a field
  const getMappingForField = useCallback((fieldName: string): PDFFieldMapping | undefined => {
    return mappings.find((m) => m.pdfFieldName === fieldName);
  }, [mappings]);
  
  // Update a mapping
  const updateMapping = useCallback((fieldName: string, updates: Partial<PDFFieldMapping>) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.pdfFieldName === fieldName ? { ...m, ...updates } : m
      )
    );
  }, []);
  
  // Toggle mapping active state
  const toggleMappingActive = useCallback((fieldName: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.pdfFieldName === fieldName ? { ...m, isActive: !m.isActive } : m
      )
    );
  }, []);
  
  // Handle prefill source change
  const handlePrefillSourceChange = useCallback((fieldName: string, source: PrefillSource) => {
    updateMapping(fieldName, {
      prefillSource: source,
      customValue: source === 'custom' ? '' : undefined,
    });
  }, [updateMapping]);
  
  // Handle custom value change
  const handleCustomValueChange = useCallback((fieldName: string, value: string) => {
    updateMapping(fieldName, { customValue: value });
  }, [updateMapping]);
  
  // Handle transform change
  const handleTransformChange = useCallback((fieldName: string, transformType: FieldTransform['type'] | '') => {
    updateMapping(fieldName, {
      transform: transformType ? { type: transformType } : undefined,
    });
  }, [updateMapping]);
  
  // Handle save
  const handleSave = useCallback(async () => {
    await onSave(mappings);
  }, [mappings, onSave]);
  
  // Count mapped fields
  const mappedCount = useMemo(() => {
    return mappings.filter((m) => m.prefillSource || m.systemFieldId).length;
  }, [mappings]);
  
  // Count active fields
  const activeCount = useMemo(() => {
    return mappings.filter((m) => m.isActive).length;
  }, [mappings]);
  
  // Get field type badge color
  const getTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'text':
        return 'default';
      case 'checkbox':
        return 'secondary';
      case 'radio':
        return 'outline';
      case 'dropdown':
        return 'secondary';
      case 'signature':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Field Mapping</h3>
          <p className="text-sm text-muted-foreground">
            Map PDF form fields to system fields for automatic population
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {mappedCount} of {fields.length} mapped
          </Badge>
          <Badge variant="secondary">
            {activeCount} active
          </Badge>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
        
        {!readOnly && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Auto-map common fields
                for (const field of fields) {
                  const lowerName = field.name.toLowerCase();
                  let source: PrefillSource | undefined;
                  
                  if (lowerName.includes('name') && lowerName.includes('first')) {
                    source = 'user.name';
                  } else if (lowerName.includes('email')) {
                    source = 'user.email';
                  } else if (lowerName.includes('phone') || lowerName.includes('tel')) {
                    source = 'user.phone';
                  } else if (lowerName.includes('address') && lowerName.includes('street')) {
                    source = 'user.addressStreet';
                  } else if (lowerName.includes('city')) {
                    source = 'user.addressCity';
                  } else if (lowerName.includes('state')) {
                    source = 'user.addressState';
                  } else if (lowerName.includes('post') || lowerName.includes('zip')) {
                    source = 'user.addressPostcode';
                  } else if (lowerName.includes('dob') || lowerName.includes('birth')) {
                    source = 'user.dateOfBirth';
                  }
                  
                  if (source) {
                    updateMapping(field.name, { prefillSource: source });
                  }
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Auto-Map
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Deactivate all
                setMappings((prev) =>
                  prev.map((m) => ({ ...m, isActive: false }))
                );
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Deactivate All
            </Button>
          </>
        )}
      </div>
      
      {/* Fields List */}
      <ScrollArea className="flex-1 min-h-0">
        <Accordion type="multiple" defaultValue={Object.keys(fieldsByType)} className="w-full">
          {Object.entries(fieldsByType).map(([type, typeFields]) => (
            <AccordionItem key={type} value={type}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge variant={getTypeBadgeVariant(type)}>
                    {type}
                  </Badge>
                  <span className="text-muted-foreground">
                    {typeFields.length} field{typeFields.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {typeFields.map((field) => {
                    const mapping = getMappingForField(field.name);
                    if (!mapping) return null;
                    
                    const isSelected = selectedFieldId === field.id;
                    
                    return (
                      <Card
                        key={field.id}
                        className={cn(
                          'transition-colors',
                          isSelected && 'border-primary',
                          !mapping.isActive && 'opacity-50'
                        )}
                        onClick={() => setSelectedFieldId(field.id)}
                      >
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={mapping.isActive}
                                onCheckedChange={() => !readOnly && toggleMappingActive(field.name)}
                                disabled={readOnly || !field.isFillable}
                              />
                              <CardTitle className="text-sm font-medium">
                                {field.name}
                              </CardTitle>
                              {field.required && (
                                <Badge variant="destructive" className="text-xs">
                                  Required
                                </Badge>
                              )}
                              {!field.isFillable && (
                                <Badge variant="outline" className="text-xs">
                                  Read-only
                                </Badge>
                              )}
                            </div>
                            
                            {mapping.prefillSource && (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Mapped
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            Page {field.pageNumber} • Position: ({Math.round(field.position.x)}, {Math.round(field.position.y)})
                            {field.maxLength && ` • Max: ${field.maxLength} chars`}
                          </CardDescription>
                        </CardHeader>
                        
                        {mapping.isActive && !readOnly && (
                          <CardContent className="py-3 px-4 pt-0 space-y-3">
                            {/* Prefill Source */}
                            <div className="space-y-1.5">
                              <Label className="text-xs">Prefill Source</Label>
                              <Select
                                value={mapping.prefillSource || ''}
                                onValueChange={(value) =>
                                  handlePrefillSourceChange(field.name, value as PrefillSource)
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select source..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {prefillSources.map((source) => (
                                    <SelectItem key={source} value={source}>
                                      {getPrefillSourceDisplayName(source)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Custom Value (if custom source) */}
                            {mapping.prefillSource === 'custom' && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Custom Value</Label>
                                <Input
                                  value={mapping.customValue || ''}
                                  onChange={(e) =>
                                    handleCustomValueChange(field.name, e.target.value)
                                  }
                                  placeholder="Enter custom value..."
                                  className="h-8"
                                />
                              </div>
                            )}
                            
                            {/* Transform */}
                            <div className="space-y-1.5">
                              <Label className="text-xs">Transform</Label>
                              <Select
                                value={mapping.transform?.type || ''}
                                onValueChange={(value) =>
                                  handleTransformChange(field.name, value as FieldTransform['type'])
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="No transform" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">None</SelectItem>
                                  {TRANSFORM_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Options Preview (for dropdown/radio) */}
                            {field.options && field.options.length > 0 && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Options</Label>
                                <div className="flex flex-wrap gap-1">
                                  {field.options.map((opt, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {opt.label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
      
      {/* Preview Panel */}
      {showPreview && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Mapping Preview</CardTitle>
            <CardDescription>
              Preview of field mappings that will be applied
            </CardDescription>
          </CardHeader>
          <CardContent className="py-3">
            <div className="space-y-2">
              {mappings
                .filter((m) => m.isActive && m.prefillSource)
                .map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="font-medium">{mapping.pdfFieldName}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {getPrefillSourceDisplayName(mapping.prefillSource!)}
                    </span>
                    {mapping.transform && (
                      <Badge variant="outline" className="text-xs">
                        {mapping.transform.type}
                      </Badge>
                    )}
                  </div>
                ))}
              
              {mappings.filter((m) => m.isActive && m.prefillSource).length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No field mappings configured. Select prefill sources for the fields above.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || mappedCount === 0}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Mappings
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default PDFFieldMapper;
