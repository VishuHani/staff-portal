import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockCreateFillablePdf = vi.hoisted(() => vi.fn());
const mockFillForm = vi.hoisted(() => vi.fn());
const mockGetFormFields = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/supabase-server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/services/fillable-pdf-service", () => ({
  createFillablePdf: mockCreateFillablePdf,
  PdfFormFiller: {
    fillForm: mockFillForm,
    getFormFields: mockGetFormFields,
  },
}));

import { POST as createFillablePdf } from "@/app/api/documents/fillable/route";
import { POST as fillPdf } from "@/app/api/documents/fillable/fill/route";
import { GET as extractFields } from "@/app/api/documents/fillable/fields/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  });
});

describe("fillable pdf route", () => {
  it("returns a standardized error envelope when unauthenticated", async () => {
    const response = await createFillablePdf(
      new Request("http://localhost/api/documents/fillable", {
        method: "POST",
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      error: "Unauthorized",
    });
  });

  it("returns a standardized error envelope for unauthenticated fill command", async () => {
    const response = await fillPdf(
      new Request("http://localhost/api/documents/fillable/fill", {
        method: "POST",
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      error: "Unauthorized",
    });
  });

  it("returns a standardized error envelope for unauthenticated field extraction", async () => {
    const response = await extractFields(
      new Request(
        "http://localhost/api/documents/fillable/fields?pdfUrl=https://example.com/test.pdf",
        { method: "GET" }
      ) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      error: "Unauthorized",
    });
  });
});
