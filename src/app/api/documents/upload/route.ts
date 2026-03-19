import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/auth/supabase-server';
import { hasPermission } from '@/lib/rbac/permissions';
import { documentUploadRateLimiter } from '@/lib/utils/public-rate-limit';
import { apiError, apiSuccess } from '@/lib/utils/api-response';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Document Upload API Route
 * 
 * This route handles document uploads (PDFs, images) with two strategies:
 * 1. Primary: Upload to Supabase Storage
 * 2. Fallback: Save to local filesystem (development only)
 * 
 * Supports different upload types:
 * - print-fill: PDFs for print & fill workflow
 * - submission: Completed document submissions
 * - template: Document templates
 */
export async function POST(request: NextRequest) {
  try {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateLimit = await documentUploadRateLimiter.check(ipAddress);
    if (!rateLimit.allowed) {
      const response = apiError(
        rateLimit.reason || 'Rate limit exceeded. Please try again later.',
        429
      );

      if (rateLimit.retryAfter) {
        response.headers.set('Retry-After', String(rateLimit.retryAfter));
      }

      return response;
    }

    const authClient = await createClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return apiError('Unauthorized', 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venueId') as string;
    const templateId = formData.get('templateId') as string | null;
    const uploadType = formData.get('type') as string || 'template';

    if (!file) {
      return apiError('No file provided', 400);
    }

    if (!venueId) {
      return apiError('Venue ID is required', 400);
    }

    const canUpload = await hasPermission(user.id, 'documents', 'create', venueId);
    if (!canUpload) {
      return apiError('Forbidden', 403);
    }

    // Validate file type based on upload type
    const allowedTypes = getAllowedTypes(uploadType);
    if (!allowedTypes.includes(file.type)) {
      return apiError(
        `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        400
      );
    }

    // Validate file size (max 20MB for PDFs, 10MB for images)
    const maxSize = file.type === 'application/pdf' ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return apiError(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`, 400);
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `documents/${venueId}/${uploadType}/${templateId || 'new'}/${timestamp}_${sanitizedFileName}`;

    // Try Supabase Storage first
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data, error } = await supabase.storage
        .from('document-uploads')
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (!error && data) {
        // Success - get public URL
        const { data: urlData } = supabase.storage
          .from('document-uploads')
          .getPublicUrl(data.path);

        return apiSuccess({
          url: urlData.publicUrl,
          path: data.path,
          method: 'supabase',
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
      }

      // Log the error but continue to fallback
      console.warn('Supabase storage upload failed:', error?.message);
    } catch (supabaseError) {
      console.warn('Supabase storage error:', supabaseError);
    }

    // Fallback: Local filesystem (development only)
    if (process.env.NODE_ENV === 'development') {
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents', venueId, uploadType);
        if (!existsSync(uploadsDir)) {
          mkdirSync(uploadsDir, { recursive: true });
        }

        // Write file
        const localPath = join(uploadsDir, `${timestamp}_${sanitizedFileName}`);
        writeFileSync(localPath, buffer);

        // Return local URL
        const localUrl = `/uploads/documents/${venueId}/${uploadType}/${timestamp}_${sanitizedFileName}`;

        console.log('Document saved to local filesystem:', localPath);

        return apiSuccess({
          url: localUrl,
          path: localPath,
          method: 'local',
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          warning: 'File saved locally. Configure Supabase storage for production.',
        });
      } catch (fsError) {
        console.error('Local filesystem fallback failed:', fsError);
      }
    }

    // If all methods fail, return error with helpful message
    return apiError(
      'Document upload failed. Please ensure the "document-uploads" bucket exists in Supabase Storage.',
      500,
      {
        details:
          'The storage bucket "document-uploads" was not found. Please create it in your Supabase dashboard or contact your administrator.',
      }
    );

  } catch (error) {
    console.error('Document upload error:', error);
    return apiError('Failed to process upload', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get allowed MIME types based on upload type
 */
function getAllowedTypes(uploadType: string): string[] {
  switch (uploadType) {
    case 'print-fill':
      return ['application/pdf'];
    case 'submission':
      return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    case 'template':
      return ['application/pdf'];
    default:
      return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  }
}
