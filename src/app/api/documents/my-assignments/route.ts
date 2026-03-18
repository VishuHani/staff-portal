import { NextResponse } from "next/server";
import { listMyDocumentAssignments } from "@/lib/actions/documents/assignments";

export async function GET() {
  try {
    const result = await listMyDocumentAssignments();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch assignments" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ assignments: result.data });
  } catch (error) {
    console.error("Error in /api/documents/my-assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
