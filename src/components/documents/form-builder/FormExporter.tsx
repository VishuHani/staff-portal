'use client';

import * as React from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Code, 
  FileCode,
  File,
  Loader2,
  Settings,
  ChevronRight,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FormSchema,
  FormField,
} from '@/lib/types/form-schema';
import {
  ExportFormat,
  PDFExportOptions,
  PDFPageSize,
  PDFOrientation,
  PDFLayoutType,
  DEFAULT_PDF_OPTIONS,
  getFileExtension,
  getMimeType,
  generateExportFilename,
} from '@/lib/types/form-export';

// ============================================================================
// EXPORT FORMAT CARD
// ============================================================================

interface ExportFormatCardProps {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

function ExportFormatCard({
  format,
  label,
  description,
  icon,
  selected,
  onSelect,
}: ExportFormatCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all w-full",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      )}
    >
      <div className={cn(
        "p-2 rounded-lg",
        selected ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {selected && <Check className="h-4 w-4 text-primary" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ============================================================================
// PDF OPTIONS PANEL
// ============================================================================

interface PDFOptionsPanelProps {
  options: PDFExportOptions;
  onChange: (options: PDFExportOptions) => void;
}

function PDFOptionsPanel({ options, onChange }: PDFOptionsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Layout */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Layout</Label>
        <Select
          value={options.layout}
          onValueChange={(v) => onChange({ ...options, layout: v as PDFLayoutType })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="form">Form Preview</SelectItem>
            <SelectItem value="submission">Filled Submission</SelectItem>
            <SelectItem value="summary">Summary Report</SelectItem>
            <SelectItem value="blank">Blank Form</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Page Size & Orientation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Page Size</Label>
          <Select
            value={options.pageSize}
            onValueChange={(v) => onChange({ ...options, pageSize: v as PDFPageSize })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="Letter">Letter</SelectItem>
              <SelectItem value="Legal">Legal</SelectItem>
              <SelectItem value="A3">A3</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Orientation</Label>
          <Select
            value={options.orientation}
            onValueChange={(v) => onChange({ ...options, orientation: v as PDFOrientation })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Content Options */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Include</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={options.content?.includeFieldDescriptions}
              onCheckedChange={(checked) => onChange({
                ...options,
                content: { ...options.content, includeFieldDescriptions: !!checked }
              })}
            />
            <span className="text-sm">Field descriptions</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={options.content?.includeHelpText}
              onCheckedChange={(checked) => onChange({
                ...options,
                content: { ...options.content, includeHelpText: !!checked }
              })}
            />
            <span className="text-sm">Help text</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={options.content?.includeEmptyFields}
              onCheckedChange={(checked) => onChange({
                ...options,
                content: { ...options.content, includeEmptyFields: !!checked }
              })}
            />
            <span className="text-sm">Empty fields</span>
          </label>
        </div>
      </div>
      
      {/* Header/Footer */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Header & Footer</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={options.header?.includeTitle}
              onCheckedChange={(checked) => onChange({
                ...options,
                header: { ...options.header, includeTitle: !!checked }
              })}
            />
            <span className="text-sm">Form title in header</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={options.header?.includeDate}
              onCheckedChange={(checked) => onChange({
                ...options,
                header: { ...options.header, includeDate: !!checked }
              })}
            />
            <span className="text-sm">Date in header</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={options.footer?.includePageNumbers}
              onCheckedChange={(checked) => onChange({
                ...options,
                footer: { ...options.footer, includePageNumbers: !!checked }
              })}
            />
            <span className="text-sm">Page numbers</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT DIALOG COMPONENT
// ============================================================================

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: FormSchema;
  onExport: (format: ExportFormat, options: unknown) => Promise<void>;
}

function ExportDialog({ open, onOpenChange, schema, onExport }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>('pdf');
  const [pdfOptions, setPdfOptions] = React.useState<PDFExportOptions>(DEFAULT_PDF_OPTIONS);
  const [isExporting, setIsExporting] = React.useState(false);
  const [filename, setFilename] = React.useState('');
  
  React.useEffect(() => {
    setFilename(generateExportFilename(schema.name, selectedFormat, true).replace(/\.[^.]+$/, ''));
  }, [schema.name, selectedFormat]);
  
  const formats: Array<{
    format: ExportFormat;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    { format: 'pdf', label: 'PDF', description: 'Portable document format', icon: <FileText className="h-4 w-4" /> },
    { format: 'json', label: 'JSON', description: 'Schema and data', icon: <Code className="h-4 w-4" /> },
    { format: 'html', label: 'HTML', description: 'Standalone web form', icon: <FileCode className="h-4 w-4" /> },
    { format: 'csv', label: 'CSV', description: 'Spreadsheet data', icon: <FileSpreadsheet className="h-4 w-4" /> },
  ];
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const options = selectedFormat === 'pdf' ? pdfOptions : {};
      await onExport(selectedFormat, options);
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Export Form</DialogTitle>
          <DialogDescription>
            Choose a format and options for your export
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="grid grid-cols-2 gap-3">
            {formats.map((f) => (
              <ExportFormatCard
                key={f.format}
                {...f}
                selected={selectedFormat === f.format}
                onSelect={() => setSelectedFormat(f.format)}
              />
            ))}
          </div>
          
          {/* Filename */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Filename</Label>
            <div className="flex items-center gap-2">
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="h-8"
              />
              <span className="text-sm text-muted-foreground">
                {getFileExtension(selectedFormat)}
              </span>
            </div>
          </div>
          
          {/* Format-specific options */}
          {selectedFormat === 'pdf' && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">PDF Options</span>
              </div>
              <PDFOptionsPanel options={pdfOptions} onChange={setPdfOptions} />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// QUICK EXPORT BUTTON
// ============================================================================

export interface QuickExportButtonProps {
  schema: FormSchema;
  onExport: (format: ExportFormat) => Promise<void>;
  defaultFormat?: ExportFormat;
}

function QuickExportButton({ schema, onExport, defaultFormat = 'pdf' }: QuickExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(defaultFormat);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Button onClick={handleExport} disabled={isExporting} variant="outline" size="sm">
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="ml-2 hidden sm:inline">Export</span>
    </Button>
  );
}

// ============================================================================
// FORM EXPORTER COMPONENT
// ============================================================================

export interface FormExporterProps {
  schema: FormSchema;
  onExportJSON?: (schema: FormSchema) => void;
  onExportPDF?: (schema: FormSchema, options: PDFExportOptions) => Promise<void>;
  className?: string;
}

export function FormExporter({ schema, onExportJSON, onExportPDF, className }: FormExporterProps) {
  const [showDialog, setShowDialog] = React.useState(false);
  
  const handleExport = async (format: ExportFormat, options: unknown) => {
    switch (format) {
      case 'json':
        // Export as JSON
        const json = JSON.stringify(schema, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateExportFilename(schema.name, 'json');
        a.click();
        URL.revokeObjectURL(url);
        onExportJSON?.(schema);
        break;
        
      case 'pdf':
        // For PDF, we would typically use a server action
        // For now, export as HTML that can be printed to PDF
        if (onExportPDF) {
          await onExportPDF(schema, options as PDFExportOptions);
        } else {
          // Fallback: print window
          window.print();
        }
        break;
        
      case 'html':
        // Export as HTML
        const html = generateHTMLForm(schema);
        const htmlBlob = new Blob([html], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        const htmlLink = document.createElement('a');
        htmlLink.href = htmlUrl;
        htmlLink.download = generateExportFilename(schema.name, 'html');
        htmlLink.click();
        URL.revokeObjectURL(htmlUrl);
        break;
        
      case 'csv':
        // Export as CSV
        const csv = generateCSV(schema);
        const csvBlob = new Blob([csv], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = generateExportFilename(schema.name, 'csv');
        csvLink.click();
        URL.revokeObjectURL(csvUrl);
        break;
    }
  };
  
  return (
    <>
      <Button onClick={() => setShowDialog(true)} variant="outline" size="sm" className={className}>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
      
      <ExportDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        schema={schema}
        onExport={handleExport}
      />
    </>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateHTMLForm(schema: FormSchema): string {
  const fields = schema.fields.map(field => {
    const required = field.required ? ' required' : '';
    const helpText = field.helpText ? `<p class="help-text">${field.helpText}</p>` : '';
    
    let inputHtml = '';
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        inputHtml = `<input type="${field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}" name="${field.id}" placeholder="${field.placeholder || ''}"${required}>`;
        break;
      case 'textarea':
        inputHtml = `<textarea name="${field.id}" placeholder="${field.placeholder || ''}"${required}></textarea>`;
        break;
      case 'number':
        inputHtml = `<input type="number" name="${field.id}" placeholder="${field.placeholder || ''}"${required}>`;
        break;
      case 'date':
        inputHtml = `<input type="date" name="${field.id}"${required}>`;
        break;
      case 'select':
        const options = (field.options || []).map(opt => 
          `<option value="${opt.value}">${opt.label}</option>`
        ).join('');
        inputHtml = `<select name="${field.id}"${required}><option value="">Select...</option>${options}</select>`;
        break;
      case 'checkbox':
        inputHtml = `<input type="checkbox" name="${field.id}"${required}>`;
        break;
      case 'radio':
        const radios = (field.options || []).map(opt => 
          `<label><input type="radio" name="${field.id}" value="${opt.value}"${required}> ${opt.label}</label>`
        ).join('');
        inputHtml = `<div class="radio-group">${radios}</div>`;
        break;
      default:
        inputHtml = `<input type="text" name="${field.id}"${required}>`;
    }
    
    return `
      <div class="field">
        <label for="${field.id}">${field.label}${field.required ? ' *' : ''}</label>
        ${helpText}
        ${inputHtml}
      </div>
    `;
  }).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schema.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { margin-bottom: 0.5rem; }
    .description { color: #666; margin-bottom: 2rem; }
    .field { margin-bottom: 1.5rem; }
    label { display: block; font-weight: 500; margin-bottom: 0.25rem; }
    .help-text { font-size: 0.875rem; color: #666; margin: 0.25rem 0; }
    input, select, textarea { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    textarea { min-height: 100px; }
    .radio-group label { display: inline-flex; align-items: center; gap: 0.5rem; margin-right: 1rem; font-weight: normal; }
    .radio-group input { width: auto; }
    button { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    button:hover { background: #2563eb; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>${schema.name}</h1>
  ${schema.description ? `<p class="description">${schema.description}</p>` : ''}
  <form>
    ${fields}
    <button type="submit">Submit</button>
  </form>
</body>
</html>`;
}

function generateCSV(schema: FormSchema): string {
  const headers = ['Field ID', 'Label', 'Type', 'Required', 'Placeholder', 'Help Text'];
  const rows = schema.fields.map(field => [
    field.id,
    `"${field.label.replace(/"/g, '""')}"`,
    field.type,
    field.required ? 'Yes' : 'No',
    `"${(field.placeholder || '').replace(/"/g, '""')}"`,
    `"${(field.helpText || '').replace(/"/g, '""')}"`,
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export default FormExporter;