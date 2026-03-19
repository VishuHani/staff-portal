import { listMyDocumentAssignments } from "@/lib/actions/documents/assignments";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

export async function GET() {
  try {
    const result = await listMyDocumentAssignments();

    if (!result.success) {
      return apiError(result.error || "Failed to fetch assignments", 400);
    }

    return apiSuccess({ assignments: result.data ?? [] });
  } catch (error) {
    console.error("Error in /api/documents/my-assignments:", error);
    return apiError("Internal server error");
  }
}
