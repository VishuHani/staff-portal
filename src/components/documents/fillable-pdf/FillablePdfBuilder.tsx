'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  FileText, 
  Type, 
  CheckSquare, 
  Calendar, 
  PenTool, 
  List, 
  CircleDot,
  Move,
  Save,
  Eye,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { FormFieldDefinition, FormFieldType } from '@/lib/services/fillable-pdf-service';

interface FillablePdfBuilderProps {
  venueId: string;
  onFieldsChange?: (fields: FormFieldDefinition[]) => void;
  onPreview?: (fields: FormFieldDefinition[]) => void;
  initialFields?: FormFieldDefinition[];
}

const FIELD_TYPES: { value: FormFieldType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Text Field', icon: <Type className="h-4 w-4" /> },
  { value: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="h-4 w-4" /> },
  { value: 'date', label: 'Date Field', icon: <Calendar className="h-4 w-4" /> },
  { value: 'signature', label: 'Signature', icon: <PenTool className="h-4 w-4" /> },
  { value: 'select', label: 'Dropdown', icon: <List className="h-4 w-4" /> },
  { value: 'radio', label: 'Radio Group', icon: <CircleDot className="h-4 w-4" /> },
];

const PAGE_SIZES = [
  { value: 'letter', label: 'US Letter (8.5" x 11")' },
  { value: 'a4', label: 'A4 (210mm x 297mm)' },
  { value: 'legal', label: 'US Legal (8.5" x 14")' },
];

export function FillablePdfBuilder({ 
  venueId, 
  onFieldsChange, 
  onPreview,
  initialFields = [] 
}: FillablePdfBuilderProps) {
  const [fields, setFields] = useState<FormFieldDefinition[]>(initialFields);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<'letter' | 'a4' | 'legal'>('letter');
  const [isGenerating, setIsGenerating] = useState(false);

  const addField = useCallback((type: FormFieldType) => {
    const newField: FormFieldDefinition = {
      id: `field_${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Field ${fields.length + 1}`,
      type,
      required: false,
      position: {
        page: 0,
        x: 50,
        y: 700 - (fields.length * 40),
        width: type === 'checkbox' ? 20 : 200,
        height: type === 'checkbox' ? 20 : 25,
      },
    };

    if (type === 'select' || type === 'radio') {
      newField.options = ['Option 1', 'Option 2', 'Option 3'];
    }

    const updatedFields = [...fields, newField];
    setFields(updatedFields);
    setSelectedField(newField.id);
    onFieldsChange?.(updatedFields);
    toast.success(`Added ${type} field`);
  }, [fields, onFieldsChange]);

  const updateField = useCallback((fieldId: string, updates: Partial<FormFieldDefinition>) => {
    const updatedFields = fields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    );
    setFields(updatedFields);
    onFieldsChange?.(updatedFields);
  }, [fields, onFieldsChange]);

  const removeField = useCallback((fieldId: string) => {
    const updatedFields = fields.filter(field => field.id !== fieldId);
    setFields(updatedFields);
    if (selectedField === fieldId) {
      setSelectedField(null);
    }
    onFieldsChange?.(updatedFields);
    toast.success('Field removed');
  }, [fields, selectedField, onFieldsChange]);

  const handleGeneratePdf = useCallback(async () => {
    if (fields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/documents/fillable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Fillable Form',
          fields,
          venueId,
          options: { pageSize },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const data = await response.json();
      
      if (data.success && data.pdfUrl) {
        toast.success('Fillable PDF created!');
        // Open the PDF in a new tab
        window.open(data.pdfUrl, '_blank');
      } else {
        throw new Error(data.error || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  }, [fields, venueId, pageSize]);

  const selectedFieldData = fields.find(f => f.id === selectedField);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-4 h-full">
      {/* Left Panel - Field Types */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Add Fields</CardTitle>
          <CardDescription>Click to add a field to your form</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {FIELD_TYPES.map((fieldType) => (
            <Button
              key={fieldType.value}
              variant="outline"
              className="w-full justify-start"
              onClick={() => addField(fieldType.value)}
            >
              {fieldType.icon}
              <span className="ml-2">{fieldType.label}</span>
            </Button>
          ))}
          
          <div className="pt-4 border-t mt-4">
            <Label className="text-sm font-medium">Page Size</Label>
            <Select value={pageSize} onValueChange={(v) => setPageSize(v as typeof pageSize)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Center Panel - Field List */}
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Form Fields</CardTitle>
              <CardDescription>
                {fields.length} field{fields.length !== 1 ? 's' : ''} added
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPreview?.(fields)}
                disabled={fields.length === 0}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                size="sm"
                onClick={handleGeneratePdf}
                disabled={fields.length === 0 || isGenerating}
              >
                {isGenerating ? (
                  <span>Generating...</span>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fields added yet</p>
              <p className="text-sm">Click a field type on the left to add it</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedField === field.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedField(field.id)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{field.name}</span>
                      {field.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{field.type}</Badge>
                      {field.position && (
                        <span>Page {field.position.page + 1}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(field.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Panel - Field Properties */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Field Properties</CardTitle>
          <CardDescription>
            {selectedFieldData ? `Editing: ${selectedFieldData.name}` : 'Select a field to edit'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFieldData ? (
            <div className="text-center py-8 text-muted-foreground">
              <Move className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a field to edit its properties</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fieldName">Field Name</Label>
                <Input
                  id="fieldName"
                  value={selectedFieldData.name}
                  onChange={(e) => updateField(selectedFieldData.id, { name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fieldType">Field Type</Label>
                <Select
                  value={selectedFieldData.type}
                  onValueChange={(v) => updateField(selectedFieldData.id, { type: v as FormFieldType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="required">Required</Label>
                <Switch
                  id="required"
                  checked={selectedFieldData.required}
                  onCheckedChange={(checked) => updateField(selectedFieldData.id, { required: checked })}
                />
              </div>

              {(selectedFieldData.type === 'text' || selectedFieldData.type === 'date') && (
                <div className="space-y-2">
                  <Label htmlFor="placeholder">Placeholder Text</Label>
                  <Input
                    id="placeholder"
                    value={selectedFieldData.placeholder || ''}
                    onChange={(e) => updateField(selectedFieldData.id, { placeholder: e.target.value })}
                    placeholder="Enter placeholder..."
                  />
                </div>
              )}

              {(selectedFieldData.type === 'select' || selectedFieldData.type === 'radio') && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <Textarea
                    value={selectedFieldData.options?.join('\n') || ''}
                    onChange={(e) => updateField(selectedFieldData.id, { 
                      options: e.target.value.split('\n').filter(o => o.trim()) 
                    })}
                    placeholder="One option per line"
                    rows={4}
                  />
                </div>
              )}

              <div className="pt-4 border-t">
                <Label className="text-sm font-medium">Position</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">X</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.position?.x || 0}
                      onChange={(e) => updateField(selectedFieldData.id, { 
                        position: { ...selectedFieldData.position!, x: Number(e.target.value) } 
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Y</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.position?.y || 0}
                      onChange={(e) => updateField(selectedFieldData.id, { 
                        position: { ...selectedFieldData.position!, y: Number(e.target.value) } 
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Width</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.position?.width || 200}
                      onChange={(e) => updateField(selectedFieldData.id, { 
                        position: { ...selectedFieldData.position!, width: Number(e.target.value) } 
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Height</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.position?.height || 25}
                      onChange={(e) => updateField(selectedFieldData.id, { 
                        position: { ...selectedFieldData.position!, height: Number(e.target.value) } 
                      })}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Page</Label>
                  <Input
                    type="number"
                    min={0}
                    value={(selectedFieldData.position?.page || 0) + 1}
                    onChange={(e) => updateField(selectedFieldData.id, { 
                      position: { ...selectedFieldData.position!, page: Math.max(0, Number(e.target.value) - 1) } 
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FillablePdfBuilder;
