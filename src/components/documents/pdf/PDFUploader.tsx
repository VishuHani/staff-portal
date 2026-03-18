'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import {
  PDFUploadProgress,
  PDFUploadOptions,
  PDFValidationResult,
  PDFDocumentInfo,
  ExtractedPDFField,
  DEFAULT_PDF_UPLOAD_OPTIONS,
} from '@/lib/documents/pdf-types';
import { extractPDFFormFields, getPDFDocumentInfo } from '@/lib/documents/pdf-field-extraction';

/**
 * Props for the PDFUploader component
 */
interface PDFUploaderProps {
  /** Called when upload completes successfully */
  onUploadComplete?: (result: {
    url: string;
    fileName: string;
    fileSize: number;
    documentInfo: PDFDocumentInfo;
    formFields: ExtractedPDFField[];
  }) => void;
  /** Called when upload fails */
  onUploadError?: (error: string) => void;
  /** Called when upload progress updates */
  onProgress?: (progress: PDFUploadProgress) => void;
  /** Upload options */
  options?: Partial<PDFUploadOptions>;
  /** Venue ID for storage path */
  venueId: string;
  /** Template ID for storage path */
  templateId?: string;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accepted file types override */
  accept?: string;
}

/**
 * PDF Uploader Component
 * 
 * Provides drag-and-drop PDF upload with:
 * - File validation (size, type)
 * - Progress tracking
 * - Thumbnail generation
 * - Form field extraction
 * - Supabase storage integration
 */
export function PDFUploader({
  onUploadComplete,
  onUploadError,
  onProgress,
  options = {},
  venueId,
  templateId,
  disabled = false,
  className,
  accept = '.pdf,application/pdf',
}: PDFUploaderProps) {
  const mergedOptions = { ...DEFAULT_PDF_UPLOAD_OPTIONS, ...options };
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<PDFUploadProgress>({
    status: 'idle',
    progress: 0,
    bytesUploaded: 0,
    bytesTotal: 0,
  });
  const [validationResult, setValidationResult] = useState<PDFValidationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /**
   * Validate a PDF file
   */
  const validateFile = useCallback((file: File): PDFValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file type
    if (!mergedOptions.allowedTypes?.includes(file.type)) {
      errors.push('Invalid file type. Only PDF files are allowed.');
    }

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      errors.push('File must have a .pdf extension.');
    }

    // Check file size
    if (mergedOptions.maxSize && file.size > mergedOptions.maxSize) {
      const maxSizeMB = (mergedOptions.maxSize / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      errors.push(`File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB).`);
    }

    // Check for very large files (warning only)
    if (file.size > 5 * 1024 * 1024) {
      warnings.push('Large file detected. Processing may take longer.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileSize: file.size,
      fileName: file.name,
    };
  }, [mergedOptions]);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((file: File) => {
    if (disabled) return;

    const validation = validateFile(file);
    setValidationResult(validation);
    
    if (validation.valid) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  }, [disabled, validateFile]);

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  /**
   * Handle input file change
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /**
   * Upload file to Supabase storage with fallback
   */
  const uploadToStorage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${mergedOptions.pathPrefix}/${venueId}/${templateId || 'new'}/${timestamp}_${sanitizedFileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('document-uploads')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        // Check for specific bucket not found error
        if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
          console.warn('Storage bucket "document-uploads" not found, using server-side fallback');
          return await uploadViaServerAction(file, venueId, templateId);
        }
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('document-uploads')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      // If client-side upload fails, try server-side fallback
      if (error instanceof Error && error.message.includes('Bucket not found')) {
        console.warn('Storage bucket error, attempting server-side upload');
        return await uploadViaServerAction(file, venueId, templateId);
      }
      throw error;
    }
  };

  /**
   * Fallback: Upload via server action
   */
  const uploadViaServerAction = async (file: File, venueId: string, templateId?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('venueId', venueId);
    if (templateId) {
      formData.append('templateId', templateId);
    }

    const response = await fetch('/api/documents/upload-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server upload failed: ${response.status}`);
    }

    const result = await response.json();
    return result.url;
  };

  /**
   * Process uploaded PDF (extract fields, generate thumbnails)
   */
  const processPDF = async (file: File): Promise<{
    documentInfo: PDFDocumentInfo;
    formFields: ExtractedPDFField[];
  }> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Get document info
    const documentInfo = await getPDFDocumentInfo(arrayBuffer);
    
    // Extract form fields if enabled
    let formFields: ExtractedPDFField[] = [];
    if (mergedOptions.extractFields && documentInfo.hasFormFields) {
      formFields = await extractPDFFormFields(arrayBuffer);
    }

    return { documentInfo, formFields };
  };

  /**
   * Handle upload
   */
  const handleUpload = async () => {
    if (!selectedFile || disabled) return;

    const updateProgress = (progress: Partial<PDFUploadProgress>) => {
      const newProgress = { ...uploadProgress, ...progress };
      setUploadProgress(newProgress);
      onProgress?.(newProgress);
    };

    try {
      // Start validation
      updateProgress({ status: 'validating', progress: 0 });

      // Start upload
      updateProgress({ status: 'uploading', progress: 10, bytesTotal: selectedFile.size });

      // Upload to storage
      const url = await uploadToStorage(selectedFile);
      
      updateProgress({ 
        status: 'processing', 
        progress: 60, 
        bytesUploaded: selectedFile.size,
        url,
      });

      // Process PDF
      const { documentInfo, formFields } = await processPDF(selectedFile);

      updateProgress({
        status: 'complete',
        progress: 100,
        documentInfo,
        formFields,
      });

      // Call completion callback
      onUploadComplete?.({
        url,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        documentInfo,
        formFields,
      });

      // Reset state after successful upload
      setTimeout(() => {
        setSelectedFile(null);
        setValidationResult(null);
        setUploadProgress({ status: 'idle', progress: 0, bytesUploaded: 0, bytesTotal: 0 });
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      updateProgress({
        status: 'error',
        error: errorMessage,
      });

      onUploadError?.(errorMessage);
    }
  };

  /**
   * Clear selected file
   */
  const handleClear = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setUploadProgress({ status: 'idle', progress: 0, bytesUploaded: 0, bytesTotal: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isUploading = ['validating', 'uploading', 'processing'].includes(uploadProgress.status);

  return (
    <div className={cn('w-full', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && !selectedFile && fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer',
          'flex flex-col items-center justify-center min-h-[200px]',
          isDragging && 'border-primary bg-primary/5',
          selectedFile && 'border-solid',
          disabled && 'opacity-50 cursor-not-allowed',
          !selectedFile && !isDragging && 'border-muted-foreground/25 hover:border-primary/50',
          selectedFile && 'border-primary/50 bg-muted/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragging ? 'Drop PDF here' : 'Drag & drop PDF here'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: {(mergedOptions.maxSize! / (1024 * 1024)).toFixed(0)}MB
            </p>
          </>
        ) : (
          <div className="flex items-center gap-4 w-full">
            <FileText className="h-10 w-10 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationResult && !validationResult.valid && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationResult.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Warnings */}
      {validationResult && validationResult.warnings.length > 0 && (
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationResult.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress.status === 'validating' && 'Validating...'}
              {uploadProgress.status === 'uploading' && 'Uploading...'}
              {uploadProgress.status === 'processing' && 'Processing PDF...'}
            </span>
            <span>{uploadProgress.progress}%</span>
          </div>
          <Progress value={uploadProgress.progress} />
        </div>
      )}

      {/* Success Message */}
      {uploadProgress.status === 'complete' && (
        <Alert className="mt-4 border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            PDF uploaded successfully!
            {uploadProgress.formFields && uploadProgress.formFields.length > 0 && (
              <span className="ml-1">
                Found {uploadProgress.formFields.length} form field(s).
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {uploadProgress.status === 'error' && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Upload Failed</p>
              <p className="text-sm">{uploadProgress.error}</p>
              {uploadProgress.error?.includes('bucket') && (
                <p className="text-xs text-muted-foreground">
                  The storage bucket may not be configured. Please contact your administrator 
                  or try again later.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpload}
                className="mt-2"
              >
                Retry Upload
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Button */}
      {selectedFile && validationResult?.valid && !isUploading && uploadProgress.status !== 'complete' && (
        <Button
          onClick={handleUpload}
          className="mt-4 w-full"
          disabled={disabled}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload PDF
        </Button>
      )}
    </div>
  );
}

export default PDFUploader;
