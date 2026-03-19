import { createClient } from "@/lib/auth/supabase-server";
import { z } from "zod";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export const FormFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["text", "checkbox", "signature", "date", "select", "radio"]),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  position: z
    .object({
      page: z.number(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export const CreateFillablePdfSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema),
  venueId: z.string(),
  options: z
    .object({
      author: z.string().optional(),
      subject: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      pageSize: z.enum(["letter", "a4", "legal"]).optional(),
    })
    .optional(),
});

export const FillPdfSchema = z.object({
  pdfUrl: z.string().url(),
  fieldData: z.array(
    z.object({
      fieldId: z.string(),
      value: z.union([z.string(), z.boolean()]),
    })
  ),
  venueId: z.string(),
});

export async function getAuthenticatedRequestContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
    authError,
  };
}

/**
 * Upload PDF to storage (Supabase or local fallback)
 */
export async function uploadPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pdfBytes: Uint8Array,
  venueId: string,
  fileName: string
): Promise<{ url: string; method: string }> {
  const storagePath = `documents/${venueId}/fillable/${fileName}`;

  // Try Supabase Storage first
  try {
    const { data, error } = await supabase.storage
      .from("document-uploads")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from("document-uploads")
        .getPublicUrl(data.path);

      return { url: urlData.publicUrl, method: "supabase" };
    }
  } catch (error) {
    console.warn("Supabase storage upload failed:", error);
  }

  // Fallback to local storage
  const uploadsDir = join(
    process.cwd(),
    "public",
    "uploads",
    "documents",
    venueId,
    "fillable"
  );
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const localPath = join(uploadsDir, fileName);
  writeFileSync(localPath, pdfBytes);

  return {
    url: `/uploads/documents/${venueId}/fillable/${fileName}`,
    method: "local",
  };
}
