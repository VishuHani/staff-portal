import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 20MB limit' },
        { status: 400 }
      );
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

        return NextResponse.json({
          success: true,
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

        return NextResponse.json({
          success: true,
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
    return NextResponse.json(
      { 
        error: 'PDF upload failed. Please ensure the "document-uploads" bucket exists in Supabase Storage.',
        details: 'The storage bucket "document-uploads" was not found. Please create it in your Supabase dashboard or contact your administrator.',
      },
      { status: 500 }
    );

  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
