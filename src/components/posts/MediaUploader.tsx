"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPostMedia, deletePostMedia } from "@/lib/actions/media";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MediaFile {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface MediaUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

export function MediaUploader({
  value = [],
  onChange,
  maxFiles = 4,
  disabled = false,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<MediaFile[]>([]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - value.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    setUploading(true);
    const newUrls: string[] = [];
    const newFiles: MediaFile[] = [];

    for (const file of filesToUpload) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(
          `${file.name}: Invalid file type. Allowed: images, videos (MP4, WebM), PDFs`
        );
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `${file.name}: File too large (max 5MB)`
        );
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadPostMedia(formData);

        if (result.error) {
          toast.error(`${file.name}: ${result.error}`);
        } else if (result.url) {
          newUrls.push(result.url);
          newFiles.push({
            url: result.url,
            fileName: result.fileName,
            fileType: result.fileType,
            fileSize: result.fileSize,
          });
          toast.success(`${file.name} uploaded successfully`);
        }
      } catch (error) {
        toast.error(`${file.name}: Upload failed`);
      }
    }

    setUploading(false);

    if (newUrls.length > 0) {
      onChange([...value, ...newUrls]);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  const handleRemove = async (urlToRemove: string) => {
    try {
      const result = await deletePostMedia(urlToRemove);

      if (result.error) {
        toast.error(result.error);
      } else {
        onChange(value.filter((url) => url !== urlToRemove));
        setUploadedFiles(uploadedFiles.filter((f) => f.url !== urlToRemove));
        toast.success("File removed");
      }
    } catch (error) {
      toast.error("Failed to remove file");
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled || uploading) return;

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [disabled, uploading]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return "🖼️";
    } else if (fileType.startsWith("video/")) {
      return "🎥";
    } else if (fileType === "application/pdf") {
      return "📄";
    }
    return "📎";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canUploadMore = value.length < maxFiles;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canUploadMore && !disabled && (
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed p-6 transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleChange}
            disabled={disabled || uploading}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            id="media-upload"
          />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    Drop files here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Images, videos (MP4, WebM), or PDFs • Max 5MB each • Up to{" "}
                    {maxFiles} files
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* File limit warning */}
      {value.length >= maxFiles && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-500">
          <AlertCircle className="h-4 w-4" />
          <span>Maximum {maxFiles} files reached</span>
        </div>
      )}

      {/* Uploaded Files Preview */}
      {value.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {value.map((url, index) => {
            const file = uploadedFiles.find((f) => f.url === url);
            const isImage = file?.fileType?.startsWith("image/");
            const isVideo = file?.fileType?.startsWith("video/");

            return (
              <div
                key={url}
                className="group relative overflow-hidden rounded-lg border bg-muted/30"
              >
                {/* Preview */}
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  {isImage ? (
                    <img
                      src={url}
                      alt={file?.fileName || `Media ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : isVideo ? (
                    <video
                      src={url}
                      className="h-full w-full object-cover"
                      controls
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* File Info */}
                {file && (
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">
                      {getFileIcon(file.fileType)} {file.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                )}

                {/* Remove Button */}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleRemove(url)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
