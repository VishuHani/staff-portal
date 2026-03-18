'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Download, 
  Eye,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface PrintFillDocumentUploaderProps {
  venueId: string;
  onUploadComplete?: (result: { url: string; fileName: string; fileSize: number }) => void;
}

interface UploadedDocument {
  url: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PrintFillDocumentUploader({ 
  venueId, 
  onUploadComplete 
}: PrintFillDocumentUploaderProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedDocument | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('venueId', venueId);
      formData.append('type', 'print-fill');

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Upload to server
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();

      setUploadedDocument({
        url: result.url,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date(),
      });

      toast.success('Document uploaded successfully');

      if (onUploadComplete) {
        onUploadComplete({
          url: result.url,
          fileName: file.name,
          fileSize: file.size,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [venueId, onUploadComplete]);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }, [handleFileUpload]);

  // Clear uploaded document
  const handleClear = useCallback(() => {
    setUploadedDocument(null);
  }, []);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!uploadedDocument ? (
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploading document...</p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-lg font-medium">Drop your PDF here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports PDF files up to 10MB
                </p>
              </div>
              <Button variant="outline" className="mt-4">
                <FileText className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Uploaded Document Preview */
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Document Uploaded</CardTitle>
                  <CardDescription>{uploadedDocument.fileName}</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{formatFileSize(uploadedDocument.fileSize)}</span>
              <span>•</span>
              <span>PDF Document</span>
              <span>•</span>
              <span>Uploaded just now</span>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" asChild>
                <a href={uploadedDocument.url} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={uploadedDocument.url} download={uploadedDocument.fileName}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How Print & Fill Documents Work:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Upload a PDF document that staff need to print and fill</li>
              <li>Staff will download and print the document</li>
              <li>Staff fill out the document by hand and sign if required</li>
              <li>Staff scan or photograph the completed document</li>
              <li>Staff upload the completed document back to the system</li>
              <li>AI analyzes the uploaded document for completeness</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PrintFillDocumentUploader;
