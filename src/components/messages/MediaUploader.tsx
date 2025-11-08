"use client";

import { useRef, useState } from "react";
import { Image, X, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPostMedia } from "@/lib/actions/media";
import { toast } from "sonner";

interface MediaUploaderProps {
  onUploadComplete: (urls: string[]) => void;
  maxFiles?: number;
}

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

export function MediaUploader({
  onUploadComplete,
  maxFiles = 4,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    if (uploadedFiles.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const newUploadedFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const result = await uploadPostMedia(formData);

        if (result.error) {
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        } else if (result.success && result.url) {
          newUploadedFiles.push({
            url: result.url,
            name: result.fileName || file.name,
            type: result.fileType || file.type,
            size: result.fileSize || file.size,
          });
        }

        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newUploadedFiles.length > 0) {
      const allFiles = [...uploadedFiles, ...newUploadedFiles];
      setUploadedFiles(allFiles);
      onUploadComplete(allFiles.map((f) => f.url));
      toast.success(`${newUploadedFiles.length} file(s) uploaded`);
    }

    setUploading(false);
    setUploadProgress(0);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUploadComplete(newFiles.map((f) => f.url));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openFilePicker}
        disabled={uploading || uploadedFiles.length >= maxFiles}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading... {Math.round(uploadProgress)}%
          </>
        ) : (
          <>
            <Image className="mr-2 h-4 w-4" />
            Add Files ({uploadedFiles.length}/{maxFiles})
          </>
        )}
      </Button>

      {/* Preview uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((file, index) => {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");

            return (
              <div
                key={index}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border bg-muted"
              >
                {isImage ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                ) : isVideo ? (
                  <video
                    src={file.url}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
