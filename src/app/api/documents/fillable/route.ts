// ============================================================================
// FILLABLE PDF API ENDPOINTS
// Create and manage fillable PDF documents
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/auth/supabase-server';
import { PdfFormFiller, createFillablePdf } from '@/lib/services/fillable-pdf-service';
import { z } from 'zod';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const FormFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'checkbox', 'signature', 'date', 'select', 'radio']),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  validation: z.object({
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  position: z.object({
    page: z.number(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const CreateFillablePdfSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema),
  venueId: z.string(),
  options: z.object({
    author: z.string().optional(),
    subject: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    pageSize: z.enum(['letter', 'a4', 'legal']).optional(),
  }).optional(),
});

const FillPdfSchema = z.object({
  pdfUrl: z.string().url(),
  fieldData: z.array(z.object({
    fieldId: z.string(),
    value: z.union([z.string(), z.boolean()]),
  })),
  venueId: z.string(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Upload PDF to storage (Supabase or local fallback)
 */
async function uploadPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pdfBytes: Uint8Array,
  venueId: string,
  fileName: string
): Promise<{ url: string; method: string }> {
  const storagePath = `documents/${venueId}/fillable/${fileName}`;
  
  // Try Supabase Storage first
  try {
    const { data, error } = await supabase.storage
      .from('document-uploads')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('document-uploads')
        .getPublicUrl(data.path);
      
      return { url: urlData.publicUrl, method: 'supabase' };
    }
  } catch (err) {
    console.warn('Supabase storage upload failed:', err);
  }

  // Fallback to local storage
  const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents', venueId, 'fillable');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const localPath = join(uploadsDir, fileName);
  writeFileSync(localPath, pdfBytes);

  return { 
    url: `/uploads/documents/${venueId}/fillable/${fileName}`,
    method: 'local'
  };
}

// ============================================================================
// POST: Create a new fillable PDF
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreateFillablePdfSchema.parse(body);

    // Create the fillable PDF
    const pdfBytes = await createFillablePdf(
      validatedData.title,
      validatedData.fields,
      validatedData.options || {}
    );

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${validatedData.title.toLowerCase().replace(/\s+/g, '-')}_${timestamp}.pdf`;

    // Upload to storage
    const { url, method } = await uploadPdf(supabase, pdfBytes, validatedData.venueId, fileName);

    return NextResponse.json({
      success: true,
      pdfUrl: url,
      fileName,
      fileSize: pdfBytes.length,
      fields: validatedData.fields,
      storageMethod: method,
    });
  } catch (error) {
    console.error('Error creating fillable PDF:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create fillable PDF' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT: Fill an existing PDF with data
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = FillPdfSchema.parse(body);

    // Fetch the PDF
    const response = await fetch(validatedData.pdfUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 400 });
    }
    
    const pdfArrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Fill the form
    const filledPdfBytes = await PdfFormFiller.fillForm(pdfBytes, validatedData.fieldData);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `filled_form_${timestamp}.pdf`;

    // Upload to storage
    const { url, method } = await uploadPdf(supabase, filledPdfBytes, validatedData.venueId, fileName);

    return NextResponse.json({
      success: true,
      pdfUrl: url,
      fileName,
      fileSize: filledPdfBytes.length,
      storageMethod: method,
    });
  } catch (error) {
    console.error('Error filling PDF:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fill PDF' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Extract fields from a PDF
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pdfUrl = searchParams.get('pdfUrl');

    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF URL is required' }, { status: 400 });
    }

    // Fetch the PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 400 });
    }
    
    const pdfArrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Extract form fields
    const fields = await PdfFormFiller.getFormFields(pdfBytes);

    return NextResponse.json({
      success: true,
      fields,
      fieldCount: fields.length,
    });
  } catch (error) {
    console.error('Error extracting PDF fields:', error);
    
    return NextResponse.json(
      { error: 'Failed to extract PDF fields' },
      { status: 500 }
    );
  }
}
