import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venueId') as string;
    const templateId = formData.get('templateId') as string | null;
    const uploadType = formData.get('type') as string || 'template';

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

    // Validate file type based on upload type
    const allowedTypes = getAllowedTypes(uploadType);
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB for PDFs, 10MB for images)
    const maxSize = file.type === 'application/pdf' ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` },
        { status: 400 }
      );
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

        return NextResponse.json({
          success: true,
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

        return NextResponse.json({
          success: true,
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
    return NextResponse.json(
      { 
        error: 'Document upload failed. Please ensure the "document-uploads" bucket exists in Supabase Storage.',
        details: 'The storage bucket "document-uploads" was not found. Please create it in your Supabase dashboard or contact your administrator.',
      },
      { status: 500 }
    );

  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
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
