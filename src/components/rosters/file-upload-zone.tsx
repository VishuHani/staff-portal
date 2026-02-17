"use client";

/**
 * Roster File Upload Zone Component
 * Drag and drop file upload with preview and validation
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileSpreadsheet, Image, File, X, Loader2, AlertCircle, Clock, Sparkles, CheckCircle2, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { validateRosterFile, type RosterFileType } from "@/lib/storage/rosters.shared";

interface FileUploadZoneProps {
  onFileSelect: (file: File, fileType: RosterFileType) => void;
  onCancel?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  maxSizeMB?: number;
  className?: string;
}

// Progress stages for different file types
const EXCEL_CSV_STAGES = [
  { label: "Uploading file...", duration: 2000 },
  { label: "Parsing spreadsheet data...", duration: 3000 },
  { label: "Detecting columns and headers...", duration: 5000 },
  { label: "Extracting shift information...", duration: 5000 },
  { label: "Matching staff members...", duration: 3000 },
  { label: "Finalizing extraction...", duration: 2000 },
];

const IMAGE_STAGES = [
  { label: "Uploading image...", duration: 3000 },
  { label: "Preparing for AI analysis...", duration: 2000 },
  { label: "AI is reading your roster image...", duration: 60000 },
  { label: "Extracting schedule data...", duration: 60000 },
  { label: "AI is detecting columns and patterns...", duration: 45000 },
  { label: "Matching staff names to database...", duration: 10000 },
  { label: "Validating extracted data...", duration: 5000 },
  { label: "Almost done...", duration: 30000 },
];

type DragState = "idle" | "dragging" | "invalid";

export function FileUploadZone({
  onFileSelect,
  onCancel,
  isUploading = false,
  disabled = false,
  maxSizeMB = 10,
  className,
}: FileUploadZoneProps) {
  const [dragState, setDragState] = useState<DragState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<RosterFileType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress tracking
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Get stages based on file type
  const stages = fileType === "image" ? IMAGE_STAGES : EXCEL_CSV_STAGES;

  // Timer effect for elapsed time and stage progression
  useEffect(() => {
    if (!isUploading) {
      setElapsedTime(0);
      setCurrentStageIndex(0);
      startTimeRef.current = null;
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current!;
      setElapsedTime(elapsed);

      // Calculate which stage we should be on
      let totalDuration = 0;
      for (let i = 0; i < stages.length; i++) {
        totalDuration += stages[i].duration;
        if (elapsed < totalDuration) {
          setCurrentStageIndex(i);
          break;
        }
        // If we've exceeded all stages, stay on last one
        if (i === stages.length - 1) {
          setCurrentStageIndex(i);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isUploading, stages]);

  // Format elapsed time
  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Calculate progress percentage
  const calculateProgress = (): number => {
    const totalDuration = stages.reduce((sum, s) => sum + s.duration, 0);
    return Math.min(95, (elapsedTime / totalDuration) * 100);
  };

  const handleFile = useCallback((file: File) => {
    setError(null);

    const validation = validateRosterFile(file);

    if (!validation.valid) {
      setError(validation.error || "Invalid file type");
      setSelectedFile(null);
      setFileType(null);
      return;
    }

    setSelectedFile(file);
    setFileType(validation.fileType!);
    onFileSelect(file, validation.fileType!);
  }, [onFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isUploading) return;

    const items = e.dataTransfer.items;
    if (items.length > 0) {
      const item = items[0];
      if (item.kind === "file") {
        setDragState("dragging");
      }
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState("idle");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState("idle");

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, isUploading, handleFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [handleFile]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setFileType(null);
    setError(null);
    onCancel?.();
  }, [onCancel]);

  const getFileIcon = (type: RosterFileType | null) => {
    switch (type) {
      case "excel":
      case "csv":
        return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
      case "image":
        return <Image className="h-8 w-8 text-blue-600" />;
      default:
        return <File className="h-8 w-8 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // If file is selected and uploading, show detailed progress
  if (selectedFile && fileType && isUploading) {
    return (
      <div className={cn("rounded-lg border p-6", className)}>
        <div className="space-y-4">
          {/* File info header */}
          <div className="flex items-center gap-3 pb-3 border-b">
            {getFileIcon(fileType)}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)} • {fileType.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Progress content */}
          <div className="space-y-4">
            {/* Icon with animation */}
            <div className="flex justify-center py-2">
              {fileType === "image" ? (
                <div className="relative">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                  <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary/30 animate-ping" />
                </div>
              ) : (
                <div className="relative">
                  <FileSearch className="h-10 w-10 text-primary" />
                  <Loader2 className="absolute -bottom-1 -right-1 h-4 w-4 text-primary animate-spin" />
                </div>
              )}
            </div>

            {/* Current stage */}
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">
                {stages[currentStageIndex]?.label || "Processing..."}
              </p>
              {fileType === "image" && currentStageIndex >= 2 && currentStageIndex <= 4 && (
                <p className="text-xs text-muted-foreground">
                  AI Vision is analyzing your image - this can take several minutes
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={calculateProgress()} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatElapsedTime(elapsedTime)}
                </span>
                <span>
                  Step {currentStageIndex + 1} of {stages.length}
                </span>
              </div>
            </div>

            {/* Stage indicators */}
            <div className="flex justify-center gap-1.5">
              {stages.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    idx < currentStageIndex && "bg-green-500",
                    idx === currentStageIndex && "bg-primary animate-pulse",
                    idx > currentStageIndex && "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Helpful tip for images */}
            {fileType === "image" && elapsedTime > 30000 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs p-2 rounded text-center">
                Image extraction uses AI to read your roster. This typically takes 2-5 minutes depending on complexity.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If file is selected but not uploading, show preview
  if (selectedFile && fileType) {
    return (
      <div className={cn("rounded-lg border p-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getFileIcon(fileType)}
            <div>
              <p className="font-medium text-sm">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)} • {fileType.toUpperCase()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          dragState === "dragging" && "border-primary bg-primary/5",
          dragState === "invalid" && "border-destructive bg-destructive/5",
          dragState === "idle" && "border-muted-foreground/25 hover:border-muted-foreground/50",
          (disabled || isUploading) && "opacity-50 cursor-not-allowed"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="w-full max-w-sm space-y-4">
            {/* Icon with animation */}
            <div className="flex justify-center">
              {fileType === "image" ? (
                <div className="relative">
                  <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                  <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-primary/30 animate-ping" />
                </div>
              ) : (
                <div className="relative">
                  <FileSearch className="h-12 w-12 text-primary" />
                  <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 text-primary animate-spin" />
                </div>
              )}
            </div>

            {/* Current stage */}
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">
                {stages[currentStageIndex]?.label || "Processing..."}
              </p>
              {fileType === "image" && currentStageIndex >= 2 && currentStageIndex <= 4 && (
                <p className="text-xs text-muted-foreground">
                  AI Vision is analyzing your image - this can take several minutes
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={calculateProgress()} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatElapsedTime(elapsedTime)}
                </span>
                <span>
                  Step {currentStageIndex + 1} of {stages.length}
                </span>
              </div>
            </div>

            {/* Stage indicators */}
            <div className="flex justify-center gap-1.5">
              {stages.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    idx < currentStageIndex && "bg-green-500",
                    idx === currentStageIndex && "bg-primary animate-pulse",
                    idx > currentStageIndex && "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Helpful tip for images */}
            {fileType === "image" && elapsedTime > 30000 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs p-2 rounded text-center">
                Image extraction uses AI to read your roster. This typically takes 2-5 minutes depending on complexity.
              </div>
            )}
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-center">
              Drag and drop your roster file here
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              or click to browse
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                Excel (.xlsx, .xls)
              </span>
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                <File className="h-3 w-3 mr-1" />
                CSV
              </span>
              <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                <Image className="h-3 w-3 mr-1" />
                Image (.jpg, .png)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Max file size: {maxSizeMB}MB
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleBrowseClick}
              disabled={disabled}
            >
              Browse Files
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
