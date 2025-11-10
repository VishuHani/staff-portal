/**
 * Avatar Upload Utilities for Supabase Storage
 * Handles profile image uploads, updates, and deletions
 */

import { createClient } from '@/lib/auth/supabase-server';
import { generateAvatarFilename, validateProfileImage } from '@/lib/utils/profile';

const AVATAR_BUCKET = 'avatars';

/**
 * Upload avatar to Supabase Storage
 * Returns public URL if successful
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  try {
    // Validate file
    const validation = validateProfileImage(file);
    if (!validation.valid) {
      return { error: validation.error || 'Invalid file' };
    }

    const supabase = await createClient();

    // Generate unique filename
    const filename = generateAvatarFilename(userId, file);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return { error: 'Failed to upload avatar' };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(data.path);

    return { url: publicUrl };
  } catch (error) {
    console.error('Avatar upload error:', error);
    return { error: 'Failed to upload avatar' };
  }
}

/**
 * Delete avatar from Supabase Storage
 */
export async function deleteAvatar(avatarUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Extract path from URL
    const urlParts = avatarUrl.split(`/${AVATAR_BUCKET}/`);
    if (urlParts.length !== 2) {
      return { success: false, error: 'Invalid avatar URL' };
    }

    const path = urlParts[1];

    // Delete from storage
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([path]);

    if (error) {
      console.error('Supabase storage delete error:', error);
      return { success: false, error: 'Failed to delete avatar' };
    }

    return { success: true };
  } catch (error) {
    console.error('Avatar delete error:', error);
    return { success: false, error: 'Failed to delete avatar' };
  }
}

/**
 * Update avatar (delete old, upload new)
 */
export async function updateAvatar(
  userId: string,
  newFile: File,
  oldAvatarUrl?: string | null
): Promise<{ url: string } | { error: string }> {
  try {
    // Delete old avatar if exists
    if (oldAvatarUrl) {
      await deleteAvatar(oldAvatarUrl);
      // Continue even if deletion fails (old file orphaned but not critical)
    }

    // Upload new avatar
    return await uploadAvatar(userId, newFile);
  } catch (error) {
    console.error('Avatar update error:', error);
    return { error: 'Failed to update avatar' };
  }
}

/**
 * Ensure avatar bucket exists with proper policies
 * Should be run during setup (one-time)
 */
export async function ensureAvatarBucket(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      return { success: false, error: 'Failed to list storage buckets' };
    }

    const bucketExists = buckets?.some(bucket => bucket.name === AVATAR_BUCKET);

    if (!bucketExists) {
      // Create bucket
      const { error: createError } = await supabase.storage.createBucket(AVATAR_BUCKET, {
        public: true, // Make avatars publicly accessible
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      });

      if (createError) {
        console.error('Failed to create avatar bucket:', createError);
        return { success: false, error: 'Failed to create avatar storage bucket' };
      }

      console.log('✅ Avatar bucket created successfully');
    }

    return { success: true };
  } catch (error) {
    console.error('Avatar bucket setup error:', error);
    return { success: false, error: 'Failed to setup avatar storage' };
  }
}
