// ============================================================================
// FILLABLE PDF API ENDPOINT
// POST /api/documents/fillable (create template document)
// Related commands:
// - POST /api/documents/fillable/fill
// - GET /api/documents/fillable/fields?pdfUrl=...
// ============================================================================

import { NextRequest } from "next/server";
import { createFillablePdf } from "@/lib/services/fillable-pdf-service";
import { apiError, apiSuccess } from "@/lib/utils/api-response";
import { z } from "zod";
import {
  CreateFillablePdfSchema,
  getAuthenticatedRequestContext,
  uploadPdf,
} from "./shared";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, authError } = await getAuthenticatedRequestContext();
    if (authError || !user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const validatedData = CreateFillablePdfSchema.parse(body);

    const pdfBytes = await createFillablePdf(
      validatedData.title,
      validatedData.fields,
      validatedData.options || {}
    );

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const fileName = `${validatedData.title.toLowerCase().replace(/\s+/g, "-")}_${timestamp}.pdf`;

    const { url, method } = await uploadPdf(
      supabase,
      pdfBytes,
      validatedData.venueId,
      fileName
    );

    return apiSuccess({
      pdfUrl: url,
      fileName,
      fileSize: pdfBytes.length,
      fields: validatedData.fields,
      storageMethod: method,
    });
  } catch (error) {
    console.error("Error creating fillable PDF:", error);

    if (error instanceof z.ZodError) {
      return apiError("Validation error", 400, { details: error.issues });
    }

    return apiError("Failed to create fillable PDF");
  }
}
