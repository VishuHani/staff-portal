"use client";

import { useState, useRef } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./UserAvatar";
import { uploadProfileImage, deleteProfileImage } from "@/lib/actions/profile";
import { toast } from "sonner";

interface AvatarUploadProps {
  userId: string;
  currentImageUrl?: string | null;
  userName?: string;
  userEmail: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  onUploadComplete?: (imageUrl: string) => void;
  onDeleteComplete?: () => void;
}

export function AvatarUpload({
  userId,
  currentImageUrl,
  userName,
  userEmail,
  size = "xl",
  onUploadComplete,
  onDeleteComplete,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("File must be a JPEG, PNG, WebP, or GIF image");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadProfileImage(formData);

      if (result.error) {
        toast.error(result.error);
        setPreviewUrl(null);
      } else {
        toast.success("Profile image updated!");
        if (onUploadComplete && result.imageUrl) {
          onUploadComplete(result.imageUrl);
        }
      }
    } catch (error) {
      toast.error("Failed to upload image");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!currentImageUrl) return;

    setDeleting(true);
    try {
      const result = await deleteProfileImage();

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile image deleted");
        setPreviewUrl(null);
        if (onDeleteComplete) {
          onDeleteComplete();
        }
      }
    } catch (error) {
      toast.error("Failed to delete image");
    } finally {
      setDeleting(false);
    }
  };

  const displayImageUrl = previewUrl || currentImageUrl;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <UserAvatar
          imageUrl={displayImageUrl}
          name={userName}
          email={userEmail}
          size={size}
        />

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
        >
          {currentImageUrl ? (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Change Photo
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Photo
            </>
          )}
        </Button>

        {currentImageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={uploading || deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-gray-500">
        JPG, PNG, WebP, or GIF. Max 5MB.
      </p>
    </div>
  );
}
