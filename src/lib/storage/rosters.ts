/**
 * Roster File Upload Utilities for Supabase Storage (Server-Only)
 * Handles roster file uploads (Excel, CSV, Images)
 */

import { createClient } from "@/lib/auth/supabase-server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  validateRosterFile,
  generateRosterFilename,
  ROSTER_BUCKET,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  type RosterFileType,
  type RosterFileValidation,
} from "./rosters.shared";

// Re-export shared utilities for backwards compatibility
export {
  validateRosterFile,
  generateRosterFilename,
  ROSTER_BUCKET,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  type RosterFileType,
  type RosterFileValidation,
} from "./rosters.shared";

/**
 * Upload roster file to Supabase Storage
 */
export async function uploadRosterFile(
  venueId: string,
  file: File
): Promise<{ url: string; fileType: RosterFileType; fileName: string } | { error: string }> {
  try {
    // Validate file
    const validation = validateRosterFile(file);
    if (!validation.valid || !validation.fileType) {
      return { error: validation.error || "Invalid file" };
    }

    // Ensure bucket exists before uploading
    const bucketResult = await ensureRosterBucket();
    if (!bucketResult.success) {
      console.error("Failed to ensure roster bucket:", bucketResult.error);
      return { error: bucketResult.error || "Failed to setup storage" };
    }

    // Use admin client for upload to bypass RLS
    const adminClient = createAdminStorageClient();
    if (!adminClient) {
      return { error: "Storage service not configured" };
    }

    // Generate unique filename
    const filename = generateRosterFilename(venueId, validation.fileType, file.name);

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage using admin client
    const { data, error } = await adminClient.storage
      .from(ROSTER_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      return { error: "Failed to upload file" };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = adminClient.storage.from(ROSTER_BUCKET).getPublicUrl(data.path);

    return {
      url: publicUrl,
      fileType: validation.fileType,
      fileName: file.name,
    };
  } catch (error) {
    console.error("Roster file upload error:", error);
    return { error: "Failed to upload file" };
  }
}

/**
 * Delete roster file from Supabase Storage
 */
export async function deleteRosterFile(
  fileUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Extract path from URL
    const urlParts = fileUrl.split(`/${ROSTER_BUCKET}/`);
    if (urlParts.length !== 2) {
      return { success: false, error: "Invalid file URL" };
    }

    const path = urlParts[1];

    // Delete from storage
    const { error } = await supabase.storage.from(ROSTER_BUCKET).remove([path]);

    if (error) {
      console.error("Supabase storage delete error:", error);
      return { success: false, error: "Failed to delete file" };
    }

    return { success: true };
  } catch (error) {
    console.error("Roster file delete error:", error);
    return { success: false, error: "Failed to delete file" };
  }
}

/**
 * Download roster file content (for server-side processing)
 */
export async function downloadRosterFile(
  fileUrl: string
): Promise<{ data: ArrayBuffer; contentType: string } | { error: string }> {
  try {
    // Use admin client for download to bypass RLS
    const adminClient = createAdminStorageClient();
    if (!adminClient) {
      return { error: "Storage service not configured" };
    }

    // Extract path from URL
    const urlParts = fileUrl.split(`/${ROSTER_BUCKET}/`);
    if (urlParts.length !== 2) {
      return { error: "Invalid file URL" };
    }

    const path = urlParts[1];

    // Download file
    const { data, error } = await adminClient.storage.from(ROSTER_BUCKET).download(path);

    if (error || !data) {
      console.error("Supabase storage download error:", error);
      return { error: "Failed to download file" };
    }

    const arrayBuffer = await data.arrayBuffer();
    return { data: arrayBuffer, contentType: data.type };
  } catch (error) {
    console.error("Roster file download error:", error);
    return { error: "Failed to download file" };
  }
}

/**
 * Create an admin Supabase client for bucket operations
 */
function createAdminStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Ensure roster bucket exists with proper policies
 */
export async function ensureRosterBucket(): Promise<{ success: boolean; error?: string }> {
  try {
    // Use admin client for bucket operations (requires service role key)
    const adminClient = createAdminStorageClient();

    if (!adminClient) {
      console.warn("No service role key available for bucket creation");
      // Try with regular client - might work if bucket already exists
      const supabase = await createClient();
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((bucket) => bucket.name === ROSTER_BUCKET);
      if (bucketExists) {
        return { success: true };
      }
      return { success: false, error: "Service role key required to create bucket" };
    }

    // Check if bucket exists
    const { data: buckets, error: listError } = await adminClient.storage.listBuckets();

    if (listError) {
      console.error("Failed to list buckets:", listError);
      return { success: false, error: "Failed to list storage buckets" };
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === ROSTER_BUCKET);

    if (!bucketExists) {
      // Create bucket with admin client
      const { error: createError } = await adminClient.storage.createBucket(ROSTER_BUCKET, {
        public: true, // Make public for easier access (use RLS policies for security)
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: [
          ...ALLOWED_FILE_TYPES.excel,
          ...ALLOWED_FILE_TYPES.csv,
          ...ALLOWED_FILE_TYPES.image,
        ],
      });

      if (createError) {
        console.error("Failed to create roster bucket:", createError);
        return { success: false, error: "Failed to create roster storage bucket" };
      }

      console.log("Roster bucket created successfully");
    }

    return { success: true };
  } catch (error) {
    console.error("Roster bucket setup error:", error);
    return { success: false, error: "Failed to setup roster storage" };
  }
}
