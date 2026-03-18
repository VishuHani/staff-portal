'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Play, 
  Shuffle, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  Sparkles,
  FileJson,
} from 'lucide-react';
import { FormSchema, FormData, FormField, FieldType, FieldValue } from '@/lib/types/form-schema';

// ============================================================================
// TEST DATA SIMULATOR PROPS
// ============================================================================

interface TestDataSimulatorProps {
  schema: FormSchema;
  currentData: FormData;
  onApplyData: (data: FormData) => void;
}

// ============================================================================
// TEST DATA SIMULATOR COMPONENT
// ============================================================================

export function TestDataSimulator({
  schema,
  currentData,
  onApplyData,
}: TestDataSimulatorProps) {
  const [jsonInput, setJsonInput] = React.useState<string>(
    JSON.stringify(currentData, null, 2)
  );
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Update JSON input when currentData changes
  React.useEffect(() => {
    setJsonInput(JSON.stringify(currentData, null, 2));
  }, [currentData]);

  // Generate random data for a field
  const generateRandomValue = (field: FormField): unknown => {
    switch (field.type) {
      case 'text':
      case 'textarea':
        return `Sample ${field.label} ${Math.random().toString(36).substring(7)}`;
      case 'email':
        return `user${Math.floor(Math.random() * 1000)}@example.com`;
      case 'phone':
        return `04${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
      case 'number':
      case 'currency':
      case 'percentage':
        const min = field.min ?? 0;
        const max = field.max ?? 100;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      case 'date':
        const start = new Date();
        const end = new Date();
        end.setFullYear(end.getFullYear() + 1);
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
          .toISOString()
          .split('T')[0];
      case 'time':
        return `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
      case 'select':
      case 'radio':
        if (field.options && field.options.length > 0) {
          return field.options[Math.floor(Math.random() * field.options.length)].value;
        }
        return '';
      case 'multiselect':
        if (field.options && field.options.length > 0) {
          const count = Math.floor(Math.random() * field.options.length) + 1;
          const shuffled = [...field.options].sort(() => Math.random() - 0.5);
          return shuffled.slice(0, count).map((o) => o.value);
        }
        return [];
      case 'checkbox':
      case 'toggle':
        return Math.random() > 0.5;
      case 'rating':
        return Math.floor(Math.random() * (field.ratingMax || 5)) + 1;
      case 'scale':
        const scaleMin = field.scaleMin ?? 1;
        const scaleMax = field.scaleMax ?? 10;
        return Math.floor(Math.random() * (scaleMax - scaleMin + 1)) + scaleMin;
      case 'slider':
        const sliderMin = field.sliderMin ?? 0;
        const sliderMax = field.sliderMax ?? 100;
        return Math.floor(Math.random() * (sliderMax - sliderMin + 1)) + sliderMin;
      case 'url':
        return `https://example.com/${Math.random().toString(36).substring(7)}`;
      case 'matrix':
        if (field.matrixRows && field.matrixColumns) {
          const matrixData: Record<string, string | string[]> = {};
          field.matrixRows.forEach((row) => {
            if (field.matrixColumns && field.matrixColumns.length > 0) {
              matrixData[row.value] = field.matrixColumns[Math.floor(Math.random() * field.matrixColumns.length)].value;
            }
          });
          return matrixData;
        }
        return {};
      default:
        return null;
    }
  };

  // Generate random data for all fields
  const generateRandomData = () => {
    const data: FormData = {};
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    fields.forEach((field) => {
      // Skip layout fields
      if (['divider', 'header', 'paragraph', 'page_break'].includes(field.type)) {
        return;
      }
      data[field.id] = generateRandomValue(field) as FieldValue;
    });
    onApplyData(data);
  };

  // Clear all data
  const clearData = () => {
    onApplyData({});
  };

  // Apply JSON data
  const applyJsonData = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setParseError(null);
      onApplyData(parsed);
    } catch (e) {
      setParseError('Invalid JSON format');
    }
  };

  // Copy current data to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  // Download data as JSON file
  const downloadData = () => {
    const blob = new Blob([JSON.stringify(currentData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          onApplyData(parsed);
        } catch (err) {
          setParseError('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick Actions */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Quick Actions</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={generateRandomData}
            className="gap-1 h-8 text-xs"
          >
            <Shuffle className="h-3 w-3" />
            Random
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearData}
            className="gap-1 h-8 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>

      <Separator className="my-2" />

      {/* JSON Editor */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">JSON Data</Label>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="Paste JSON data here..."
          className="font-mono text-xs min-h-[100px] resize-none"
        />
        {parseError && (
          <p className="text-xs text-destructive">{parseError}</p>
        )}
        <Button
          variant="default"
          size="sm"
          onClick={applyJsonData}
          className="w-full gap-1 h-8 text-xs"
        >
          <Play className="h-3 w-3" />
          Apply JSON
        </Button>
      </div>

      <Separator className="my-2" />

      {/* Import/Export */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Import / Export</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="gap-1 h-8 text-xs"
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadData}
            className="gap-1 h-8 text-xs"
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1 h-8 text-xs"
          >
            <Upload className="h-3 w-3" />
            Upload JSON
          </Button>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Field Reference */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Field Reference</Label>
        <div className="text-xs space-y-1 max-h-32 overflow-auto">
          {(Array.isArray(schema.fields) ? schema.fields : [])
            .filter((f) => !['divider', 'header', 'paragraph', 'page_break'].includes(f.type))
            .map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-1 bg-muted/50 rounded"
              >
                <span className="truncate text-[11px]">{field.label}</span>
                <code className="text-[10px] bg-muted px-1 rounded">
                  {field.id}
                </code>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default TestDataSimulator;
