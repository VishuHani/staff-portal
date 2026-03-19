import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { apiError, apiSuccess } from '@/lib/utils/api-response';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Upload API Route
 * 
 * This route handles PDF uploads with two strategies:
 * 1. Primary: Upload to Supabase Storage
 * 2. Fallback: Save to local filesystem (development only)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venueId') as string;
    const templateId = formData.get('templateId') as string | null;

    if (!file) {
      return apiError('No file provided', 400);
    }

    if (!venueId) {
      return apiError('Venue ID is required', 400);
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return apiError('Only PDF files are allowed', 400);
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return apiError('File size exceeds 20MB limit', 400);
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `documents/${venueId}/${templateId || 'new'}/${timestamp}_${sanitizedFileName}`;

    // Try Supabase Storage first
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data, error } = await supabase.storage
        .from('document-uploads')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
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
        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents', venueId);
        if (!existsSync(uploadsDir)) {
          mkdirSync(uploadsDir, { recursive: true });
        }

        // Write file
        const localPath = join(uploadsDir, `${timestamp}_${sanitizedFileName}`);
        writeFileSync(localPath, buffer);

        // Return local URL
        const localUrl = `/uploads/documents/${venueId}/${timestamp}_${sanitizedFileName}`;

        console.log('PDF saved to local filesystem:', localPath);

        return apiSuccess({
          url: localUrl,
          path: localPath,
          method: 'local',
          warning: 'File saved locally. Configure Supabase storage for production.',
        });
      } catch (fsError) {
        console.error('Local filesystem fallback failed:', fsError);
      }
    }

    // If all methods fail, return error with helpful message
    return apiError(
      'PDF upload failed. Please ensure the "document-uploads" bucket exists in Supabase Storage.',
      500,
      {
        details:
          'The storage bucket "document-uploads" was not found. Please create it in your Supabase dashboard or contact your administrator.',
      }
    );

  } catch (error) {
    console.error('PDF upload error:', error);
    return apiError('Failed to process upload', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
