"use server";

import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/rbac/access";
import { randomUUID } from "crypto";

// Initialize Supabase client for storage operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = "post-media";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

/**
 * Upload a media file to Supabase Storage
 */
export async function uploadPostMedia(formData: FormData) {
  const user = await requireAuth();

  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { error: "No file provided" };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      };
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        error: `File type ${file.type} is not allowed. Allowed types: images, videos (MP4, WebM), and PDFs`,
      };
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${randomUUID()}.${fileExt}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file to Supabase:", error);
      return { error: "Failed to upload file" };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
  } catch (error) {
    console.error("Error in uploadPostMedia:", error);
    return { error: "Failed to upload file" };
  }
}

/**
 * Delete a media file from Supabase Storage
 */
export async function deletePostMedia(fileUrl: string) {
  const user = await requireAuth();

  try {
    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf(BUCKET_NAME);

    if (bucketIndex === -1) {
      return { error: "Invalid file URL" };
    }

    const filePath = pathParts.slice(bucketIndex + 1).join("/");

    // Verify the file belongs to the user (files are stored in user.id/ folders)
    if (!filePath.startsWith(user.id + "/")) {
      return { error: "You don't have permission to delete this file" };
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error("Error deleting file from Supabase:", error);
      return { error: "Failed to delete file" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deletePostMedia:", error);
    return { error: "Failed to delete file" };
  }
}

/**
 * Delete multiple media files from Supabase Storage
 */
export async function deleteMultiplePostMedia(fileUrls: string[]) {
  const user = await requireAuth();

  try {
    const filePaths: string[] = [];

    for (const fileUrl of fileUrls) {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split("/");
      const bucketIndex = pathParts.indexOf(BUCKET_NAME);

      if (bucketIndex === -1) {
        continue; // Skip invalid URLs
      }

      const filePath = pathParts.slice(bucketIndex + 1).join("/");

      // Verify the file belongs to the user
      if (filePath.startsWith(user.id + "/")) {
        filePaths.push(filePath);
      }
    }

    if (filePaths.length === 0) {
      return { error: "No valid files to delete" };
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (error) {
      console.error("Error deleting files from Supabase:", error);
      return { error: "Failed to delete files" };
    }

    return { success: true, deletedCount: filePaths.length };
  } catch (error) {
    console.error("Error in deleteMultiplePostMedia:", error);
    return { error: "Failed to delete files" };
  }
}

/**
 * Get storage usage statistics for the current user
 */
export async function getStorageStats() {
  const user = await requireAuth();

  try {
    // List all files for the user
    const { data: files, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(user.id, {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("Error fetching storage stats:", error);
      return { error: "Failed to fetch storage statistics" };
    }

    const totalSize = files.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
    const fileCount = files.length;

    return {
      success: true,
      stats: {
        totalSize,
        fileCount,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      },
    };
  } catch (error) {
    console.error("Error in getStorageStats:", error);
    return { error: "Failed to fetch storage statistics" };
  }
}

/**
 * Validate if a file can be uploaded based on user's storage quota
 */
export async function validateFileUpload(fileSize: number) {
  const user = await requireAuth();

  // Max 100MB per user
  const MAX_USER_STORAGE = 100 * 1024 * 1024;

  try {
    const statsResult = await getStorageStats();

    if (!statsResult.success || !statsResult.stats) {
      // Allow upload if we can't check stats (fail open)
      return { success: true, canUpload: true };
    }

    const { totalSize } = statsResult.stats;
    const newTotal = totalSize + fileSize;

    if (newTotal > MAX_USER_STORAGE) {
      return {
        success: true,
        canUpload: false,
        error: `Upload would exceed storage quota. Used: ${(totalSize / 1024 / 1024).toFixed(2)}MB / 100MB`,
      };
    }

    return {
      success: true,
      canUpload: true,
      remaining: MAX_USER_STORAGE - totalSize,
      remainingMB: ((MAX_USER_STORAGE - totalSize) / 1024 / 1024).toFixed(2),
    };
  } catch (error) {
    console.error("Error in validateFileUpload:", error);
    // Fail open - allow upload if validation fails
    return { success: true, canUpload: true };
  }
}
