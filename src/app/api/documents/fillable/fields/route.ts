import { NextRequest } from "next/server";
import { PdfFormFiller } from "@/lib/services/fillable-pdf-service";
import { apiError, apiSuccess } from "@/lib/utils/api-response";
import { getAuthenticatedRequestContext } from "../shared";

export async function GET(request: NextRequest) {
  try {
    const { user, authError } = await getAuthenticatedRequestContext();
    if (authError || !user) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const pdfUrl = searchParams.get("pdfUrl");

    if (!pdfUrl) {
      return apiError("PDF URL is required", 400);
    }

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return apiError("Failed to fetch PDF", 400);
    }

    const pdfArrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const fields = await PdfFormFiller.getFormFields(pdfBytes);

    return apiSuccess({
      fields,
      fieldCount: fields.length,
    });
  } catch (error) {
    console.error("Error extracting PDF fields:", error);
    return apiError("Failed to extract PDF fields");
  }
}
