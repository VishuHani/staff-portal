'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { Upload, X, FileIcon, Paperclip } from 'lucide-react';
import { UploadedFile } from '@/lib/types/form-schema';

/**
 * FileField - File upload field
 */
export function FileField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const files = value
    ? Array.isArray(value)
      ? value
      : [value as UploadedFile]
    : [];

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileConfig = field.fileConfig || {};
    const maxSize = fileConfig.maxSize || 10 * 1024 * 1024; // 10MB default
    const maxFiles = fileConfig.maxFiles || 1;

    // Validate file count
    if (files.length + selectedFiles.length > maxFiles) {
      return; // TODO: Show error
    }

    setUploading(true);
    try {
      const newFiles: UploadedFile[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Validate file size
        if (file.size > maxSize) {
          continue; // TODO: Show error
        }

        // For now, create a local preview
        // In production, this would upload to Supabase
        const uploadedFile: UploadedFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file), // Temporary URL
          uploadedAt: new Date(),
        };
        newFiles.push(uploadedFile);
      }

      const allFiles = fileConfig.multiple ? [...files, ...newFiles] : newFiles;
      onChange(allFiles.length === 1 ? allFiles[0] : allFiles);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (fileId: string) => {
    const remainingFiles = files.filter((f: UploadedFile) => f.id !== fileId);
    onChange(remainingFiles.length > 0 ? remainingFiles : null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      <Label
        className={cn(
          'text-sm font-medium',
          field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
        )}
      >
        {field.label}
      </Label>

      {files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25',
            error && 'border-destructive',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop files here, or click to select
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || readOnly || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : 'Select Files'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={field.fileConfig?.accept?.join(',')}
            multiple={field.fileConfig?.multiple}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={disabled || readOnly}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file: UploadedFile) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(file.id)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {field.fileConfig?.multiple && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || readOnly || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Add Another
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={field.fileConfig?.accept?.join(',')}
            multiple={field.fileConfig?.multiple}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={disabled || readOnly}
          />
        </div>
      )}

      {field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  );
}

/**
 * FileFieldBuilder - Builder preview for file field
 */
export function FileFieldBuilder({
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
      <div className="space-y-2">
        <Label
          className={cn(
            'text-sm font-medium',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label || 'File Upload'}
        </Label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center border-muted-foreground/25">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to upload files
          </p>
        </div>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default FileField;
