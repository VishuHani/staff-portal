import { NextRequest } from "next/server";
import { PdfFormFiller } from "@/lib/services/fillable-pdf-service";
import { apiError, apiSuccess } from "@/lib/utils/api-response";
import { z } from "zod";
import {
  FillPdfSchema,
  getAuthenticatedRequestContext,
  uploadPdf,
} from "../shared";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, authError } = await getAuthenticatedRequestContext();
    if (authError || !user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const validatedData = FillPdfSchema.parse(body);

    const response = await fetch(validatedData.pdfUrl);
    if (!response.ok) {
      return apiError("Failed to fetch PDF", 400);
    }

    const pdfArrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    const filledPdfBytes = await PdfFormFiller.fillForm(
      pdfBytes,
      validatedData.fieldData
    );

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const fileName = `filled_form_${timestamp}.pdf`;

    const { url, method } = await uploadPdf(
      supabase,
      filledPdfBytes,
      validatedData.venueId,
      fileName
    );

    return apiSuccess({
      pdfUrl: url,
      fileName,
      fileSize: filledPdfBytes.length,
      storageMethod: method,
    });
  } catch (error) {
    console.error("Error filling PDF:", error);

    if (error instanceof z.ZodError) {
      return apiError("Validation error", 400, { details: error.issues });
    }

    return apiError("Failed to fill PDF");
  }
}
