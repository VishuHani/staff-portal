'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Download,
  Eye,
  RefreshCw,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { analyzeDocumentSubmission, getAnalysisStatus } from '@/lib/actions/documents/document-analysis';
import type { AnalysisStatus, DocumentAnalysisResult } from '@/lib/types/document-analysis';

// ============================================================================
// TYPES
// ============================================================================

interface PrintFillSubmissionProps {
  submissionId: string;
  templateId: string;
  templateName: string;
  originalPdfUrl: string;
  originalPdfName: string;
  currentPdfUrl?: string | null;
  currentStatus?: string;
  onSubmissionComplete?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PrintFillSubmission({
  submissionId,
  templateId,
  templateName,
  originalPdfUrl,
  originalPdfName,
  currentPdfUrl,
  currentStatus,
  onSubmissionComplete,
}: PrintFillSubmissionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentPdfUrl || null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for analysis status if analyzing
  useEffect(() => {
    if (analysisStatus === 'ANALYZING') {
      setIsPolling(true);
      const interval = setInterval(async () => {
        const result = await getAnalysisStatus({ submissionId });
        if (result.success && result.data) {
          setAnalysisStatus(result.data.status as AnalysisStatus);
          if (result.data.result) {
            setAnalysisResult(result.data.result);
          }
          if (result.data.status !== 'ANALYZING') {
            setIsPolling(false);
            clearInterval(interval);
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [analysisStatus, submissionId]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file (JPEG, PNG, WebP)');
      return;
    }

    // Validate file size (max 20MB for scanned documents)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size must be less than 20MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submissionId', submissionId);
      formData.append('type', 'completed-document');

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Upload to server
      const response = await fetch('/api/documents/submissions/upload', {
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
      setUploadedUrl(result.url);
      toast.success('Document uploaded successfully');

      // Start analysis automatically
      handleAnalyze();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [submissionId]);

  // Handle analysis
  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisStatus('ANALYZING');

    try {
      const result = await analyzeDocumentSubmission({ submissionId });
      
      if (result.success && result.data) {
        setAnalysisStatus(result.data.status as AnalysisStatus);
        setAnalysisResult({
          id: `result_${submissionId}`,
          ...result.data,
          analyzedAt: new Date(),
          detectedFields: [],
          detectedText: [],
          processingTimeMs: 0,
          modelUsed: 'gpt-4o',
        } as unknown as DocumentAnalysisResult);

        if (result.data.completenessScore >= 80) {
          toast.success('Document analyzed - All fields appear to be complete!');
        } else {
          toast.warning('Document analyzed - Some fields may be missing or incomplete');
        }

        if (onSubmissionComplete) {
          onSubmissionComplete();
        }
      } else {
        setAnalysisStatus('FAILED');
        toast.error(result.error || 'Failed to analyze document');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisStatus('FAILED');
      toast.error('Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
    }
  }, [submissionId, onSubmissionComplete]);

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

  // Get status badge
  const getStatusBadge = () => {
    switch (analysisStatus) {
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'ANALYZING':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Analyzing</Badge>;
      case 'COMPLETED':
        if (analysisResult?.completenessScore && analysisResult.completenessScore >= 80) {
          return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Complete</Badge>;
        }
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Incomplete</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{templateName}</CardTitle>
              <CardDescription>Print, fill, and upload this document</CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{originalPdfName}</p>
              <p className="text-sm text-muted-foreground">Original document template</p>
            </div>
            <Button variant="outline" asChild>
              <a href={originalPdfUrl} download={originalPdfName}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      {!uploadedUrl ? (
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
          onClick={() => document.getElementById('completed-file-input')?.click()}
        >
          <input
            id="completed-file-input"
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploading completed document...</p>
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
                <p className="text-lg font-medium">Upload your completed document</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drop your scanned/filled document here or click to upload
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports PDF, JPEG, PNG, WebP (max 20MB)
              </p>
              <Button variant="outline" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Uploaded Document */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Completed Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Document uploaded</p>
                <p className="text-sm text-muted-foreground">
                  {isAnalyzing ? 'Analyzing...' : 'Ready for analysis'}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </a>
              </Button>
            </div>

            {/* Analysis Progress */}
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI is analyzing your document...</span>
                </div>
                <Progress value={66} className="w-full" />
              </div>
            )}

            {/* Analysis Results */}
            {analysisResult && analysisStatus === 'COMPLETED' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Completeness Score</span>
                  <span className={`text-2xl font-bold ${
                    (analysisResult.completenessScore || 0) >= 80 
                      ? 'text-green-500' 
                      : 'text-amber-500'
                  }`}>
                    {analysisResult.completenessScore || 0}%
                  </span>
                </div>
                
                <Progress 
                  value={analysisResult.completenessScore || 0} 
                  className={`h-3 ${
                    (analysisResult.completenessScore || 0) >= 80 
                      ? '[&>div]:bg-green-500' 
                      : '[&>div]:bg-amber-500'
                  }`}
                />

                {analysisResult.issues && analysisResult.issues.length > 0 && (
                  <Alert variant={analysisResult.completenessScore >= 80 ? 'default' : 'destructive'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      {analysisResult.completenessScore >= 80 
                        ? 'Minor issues detected' 
                        : 'Issues detected'}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                        {analysisResult.issues.slice(0, 5).map((issue, index) => (
                          <li key={index}>{issue.message}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {(analysisResult.completenessScore || 0) < 80 && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setUploadedUrl(null);
                      setAnalysisResult(null);
                      setAnalysisStatus(null);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Re-upload Document
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Download and print the original document</li>
              <li>Fill out all required fields by hand</li>
              <li>Sign the document if required</li>
              <li>Scan or take a clear photo of the completed document</li>
              <li>Upload the scanned document above</li>
              <li>AI will analyze the document for completeness</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PrintFillSubmission;
