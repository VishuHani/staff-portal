'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Upload,
  X,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  GripVertical,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

/**
 * Attachment - Represents an uploaded file
 */
export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  preview?: string;
  uploadedAt?: Date;
}

/**
 * AttachmentUploadProgress - Progress tracking for uploads
 */
export interface AttachmentUploadProgress {
  attachmentId: string;
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * AttachmentManagerProps - Props for the AttachmentManager component
 */
export interface AttachmentManagerProps {
  /** Label for the attachment field */
  label?: string;
  /** Whether attachments are required */
  required?: boolean;
  /** Help text displayed below */
  helpText?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Current attachments */
  value?: Attachment[];
  /** Callback when attachments change */
  onChange?: (attachments: Attachment[]) => void;
  /** Callback when a file is uploaded */
  onUpload?: (file: File) => Promise<string | { url: string }>;
  /** Callback when a file is removed */
  onRemove?: (attachment: Attachment) => Promise<void>;
  /** Error message to display */
  error?: string;
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Maximum total size in bytes (default: 50MB) */
  maxTotalSize?: number;
  /** Accepted file types (MIME types or extensions) */
  accept?: string[];
  /** Maximum number of files */
  maxFiles?: number;
  /** Whether to allow drag and drop */
  allowDragDrop?: boolean;
  /** Whether to allow reordering */
  allowReorder?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to show file previews */
  showPreviews?: boolean;
  /** Upload function - if provided, files will be uploaded automatically */
  uploadFn?: (file: File, onProgress?: (progress: number) => void) => Promise<string>;
}

/**
 * Get file icon based on type
 */
function getFileIcon(type: string): React.ReactNode {
  if (type.startsWith('image/')) return <FileImage className="h-8 w-8" />;
  if (type.startsWith('video/')) return <FileVideo className="h-8 w-8" />;
  if (type.startsWith('audio/')) return <FileAudio className="h-8 w-8" />;
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar')) {
    return <FileArchive className="h-8 w-8" />;
  }
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) {
    return <FileText className="h-8 w-8" />;
  }
  return <File className="h-8 w-8" />;
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file type is an image
 */
function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

/**
 * AttachmentManager - Multi-file upload with drag-drop support
 * 
 * Features:
 * - Multi-file upload with drag-drop
 * - File type validation
 * - File size validation (configurable)
 * - Progress tracking per file
 * - Preview for images, icons for other types
 * - Remove/reorder attachments
 */
export function AttachmentManager({
  label,
  required = false,
  helpText,
  disabled = false,
  readOnly = false,
  value = [],
  onChange,
  onUpload,
  onRemove,
  error,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxTotalSize = 50 * 1024 * 1024, // 50MB
  accept = [],
  maxFiles = 10,
  allowDragDrop = true,
  allowReorder = true,
  className,
  showPreviews = true,
  uploadFn,
}: AttachmentManagerProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);

  /**
   * Validate a file
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large: ${formatFileSize(file.size)}. Max: ${formatFileSize(maxSize)}`,
      };
    }

    // Check total size
    const currentTotal = value.reduce((sum, a) => sum + a.size, 0);
    if (currentTotal + file.size > maxTotalSize) {
      return {
        valid: false,
        error: `Total size would exceed limit. Max: ${formatFileSize(maxTotalSize)}`,
      };
    }

    // Check file type
    if (accept.length > 0) {
      const isAccepted = accept.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        if (type.includes('*')) {
          const [mainType] = type.split('/');
          return file.type.startsWith(mainType);
        }
        return file.type === type;
      });

      if (!isAccepted) {
        return {
          valid: false,
          error: `File type not accepted: ${file.type || 'unknown'}`,
        };
      }
    }

    // Check max files
    if (value.length >= maxFiles) {
      return {
        valid: false,
        error: `Maximum number of files reached: ${maxFiles}`,
      };
    }

    return { valid: true };
  };

  /**
   * Create attachment from file
   */
  const createAttachment = async (file: File): Promise<Attachment> => {
    const attachment: Attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      status: 'pending',
      progress: 0,
    };

    // Create preview for images
    if (isImageType(file.type)) {
      attachment.preview = await readFileAsDataURL(file);
    }

    return attachment;
  };

  /**
   * Read file as data URL
   */
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  /**
   * Handle file selection
   */
  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: Attachment[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      const attachment = await createAttachment(file);
      newAttachments.push(attachment);
    }

    if (errors.length > 0) {
      console.warn('File validation errors:', errors);
    }

    if (newAttachments.length > 0) {
      const updatedAttachments = [...value, ...newAttachments];
      onChange?.(updatedAttachments);

      // Auto-upload if upload function provided
      if (uploadFn) {
        for (const attachment of newAttachments) {
          uploadAttachment(attachment, updatedAttachments);
        }
      }
    }
  };

  /**
   * Upload an attachment
   */
  const uploadAttachment = async (
    attachment: Attachment,
    attachments: Attachment[]
  ) => {
    if (!attachment.file || !uploadFn) return;

    // Update status to uploading
    const updateProgress = (progress: number) => {
      const updated = attachments.map(a =>
        a.id === attachment.id
          ? { ...a, status: 'uploading' as const, progress }
          : a
      );
      onChange?.(updated);
    };

    try {
      updateProgress(0);
      const url = await uploadFn(attachment.file, updateProgress);

      // Update with completed status
      const updated = attachments.map(a =>
        a.id === attachment.id
          ? {
              ...a,
              status: 'completed' as const,
              progress: 100,
              url,
              uploadedAt: new Date(),
            }
          : a
      );
      onChange?.(updated);
    } catch (err) {
      console.error('Upload error:', err);
      const updated = attachments.map(a =>
        a.id === attachment.id
          ? {
              ...a,
              status: 'error' as const,
              error: err instanceof Error ? err.message : 'Upload failed',
            }
          : a
      );
      onChange?.(updated);
    }
  };

  /**
   * Handle file input change
   */
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle drag enter
   */
  const handleDragEnter = (e: React.DragEvent) => {
    if (!allowDragDrop || disabled || readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handle drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    if (!allowDragDrop || disabled || readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    if (!allowDragDrop || disabled || readOnly) return;
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * Handle drop
   */
  const handleDrop = (e: React.DragEvent) => {
    if (!allowDragDrop || disabled || readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  /**
   * Remove an attachment
   */
  const handleRemove = async (attachment: Attachment) => {
    if (onRemove) {
      await onRemove(attachment);
    }
    const updated = value.filter(a => a.id !== attachment.id);
    onChange?.(updated);
  };

  /**
   * Retry failed upload
   */
  const handleRetry = (attachment: Attachment) => {
    if (uploadFn && attachment.file) {
      uploadAttachment(attachment, value);
    }
  };

  /**
   * Handle drag start for reordering
   */
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    if (!allowReorder || disabled || readOnly) return;
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  /**
   * Handle item drag over
   */
  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    if (!allowReorder || draggedIndex === null) return;
    e.preventDefault();
    setDropTargetIndex(index);
  };

  /**
   * Handle item drop for reordering
   */
  const handleItemDrop = (e: React.DragEvent, index: number) => {
    if (!allowReorder || draggedIndex === null) return;
    e.preventDefault();

    const newAttachments = [...value];
    const [draggedItem] = newAttachments.splice(draggedIndex, 1);
    newAttachments.splice(index, 0, draggedItem);
    onChange?.(newAttachments);

    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  /**
   * Handle item drag end
   */
  const handleItemDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  // Calculate total size
  const totalSize = value.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label
          className={cn(
            'text-sm font-medium',
            required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {label}
        </Label>
      )}

      {/* Drop zone */}
      {!readOnly && (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25',
            error && 'border-destructive',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            {isDragging
              ? 'Drop files here'
              : allowDragDrop
              ? 'Drag and drop files here, or click to browse'
              : 'Click to browse files'}
          </p>
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} files, {formatFileSize(maxSize)} each, {formatFileSize(maxTotalSize)} total
          </p>
          {accept.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Accepted: {accept.join(', ')}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept.join(',')}
            multiple
            onChange={handleFileInput}
            disabled={disabled}
            className="hidden"
          />
        </div>
      )}

      {/* Attachment list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((attachment, index) => (
            <div
              key={attachment.id}
              draggable={allowReorder && !disabled && !readOnly}
              onDragStart={(e) => handleItemDragStart(e, index)}
              onDragOver={(e) => handleItemDragOver(e, index)}
              onDrop={(e) => handleItemDrop(e, index)}
              onDragEnd={handleItemDragEnd}
              className={cn(
                'flex items-center gap-3 p-3 border rounded-lg bg-card',
                draggedIndex === index && 'opacity-50',
                dropTargetIndex === index && 'border-primary border-2',
                attachment.status === 'error' && 'border-destructive'
              )}
            >
              {/* Drag handle */}
              {allowReorder && !disabled && !readOnly && (
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move flex-shrink-0" />
              )}

              {/* Preview or icon */}
              <div className="flex-shrink-0">
                {showPreviews && attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.name}
                    className="h-10 w-10 object-cover rounded"
                  />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center text-muted-foreground">
                    {getFileIcon(attachment.type)}
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>

                {/* Progress bar */}
                {attachment.status === 'uploading' && (
                  <Progress value={attachment.progress} className="h-1 mt-1" />
                )}

                {/* Error message */}
                {attachment.status === 'error' && attachment.error && (
                  <p className="text-xs text-destructive mt-1">{attachment.error}</p>
                )}
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {attachment.status === 'completed' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {attachment.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="flex-shrink-0 flex gap-1">
                  {attachment.status === 'error' && uploadFn && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(attachment)}
                      disabled={disabled}
                    >
                      Retry
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(attachment)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total size indicator */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Total: {formatFileSize(totalSize)} / {formatFileSize(maxTotalSize)}
        </p>
      )}

      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * useAttachmentManager - Hook for managing attachment state
 */
export function useAttachmentManager(initialAttachments: Attachment[] = []) {
  const [attachments, setAttachments] = React.useState<Attachment[]>(initialAttachments);
  const [isDirty, setIsDirty] = React.useState(false);

  const addAttachment = React.useCallback((attachment: Attachment) => {
    setAttachments(prev => [...prev, attachment]);
    setIsDirty(true);
  }, []);

  const removeAttachment = React.useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    setIsDirty(true);
  }, []);

  const updateAttachment = React.useCallback((id: string, updates: Partial<Attachment>) => {
    setAttachments(prev =>
      prev.map(a => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const reorderAttachments = React.useCallback((fromIndex: number, toIndex: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      const [moved] = newAttachments.splice(fromIndex, 1);
      newAttachments.splice(toIndex, 0, moved);
      return newAttachments;
    });
    setIsDirty(true);
  }, []);

  const clearAttachments = React.useCallback(() => {
    setAttachments([]);
    setIsDirty(false);
  }, []);

  const getCompletedAttachments = React.useCallback(() => {
    return attachments.filter(a => a.status === 'completed');
  }, [attachments]);

  const hasErrors = React.useCallback(() => {
    return attachments.some(a => a.status === 'error');
  }, [attachments]);

  const isUploading = React.useCallback(() => {
    return attachments.some(a => a.status === 'uploading');
  }, [attachments]);

  return {
    attachments,
    isDirty,
    setAttachments,
    addAttachment,
    removeAttachment,
    updateAttachment,
    reorderAttachments,
    clearAttachments,
    getCompletedAttachments,
    hasErrors,
    isUploading,
  };
}

export default AttachmentManager;