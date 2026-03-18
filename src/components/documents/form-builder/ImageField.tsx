'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { UploadedFile } from '@/lib/types/form-schema';

/**
 * ImageField - Image upload with preview
 */
export function ImageField({
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

  const image = value as UploadedFile | null;

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    const fileConfig = field.fileConfig || {};
    const maxSize = fileConfig.maxSize || 2 * 1024 * 1024; // 2MB default for images

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return; // TODO: Show error
    }

    // Validate file size
    if (file.size > maxSize) {
      return; // TODO: Show error
    }

    setUploading(true);
    try {
      // For now, create a local preview
      // In production, this would upload to Supabase
      const uploadedFile: UploadedFile = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file), // Temporary URL
        uploadedAt: new Date(),
      };
      onChange(uploadedFile);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
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

      {!image ? (
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
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop an image here, or click to select
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || readOnly || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : 'Select Image'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={disabled || readOnly}
          />
        </div>
      ) : (
        <div className="relative inline-block">
          <img
            src={image.url}
            alt={image.name}
            className="max-w-full h-auto rounded-lg border max-h-64 object-contain"
          />
          {!readOnly && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemove}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-1">{image.name}</p>
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
 * ImageFieldBuilder - Builder preview for image field
 */
export function ImageFieldBuilder({
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
          {field.label || 'Image Upload'}
        </Label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center border-muted-foreground/25">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to upload an image
          </p>
        </div>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default ImageField;
