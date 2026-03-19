import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

describe("api-response helpers", () => {
  it("returns a standardized success envelope while preserving payload fields", async () => {
    const response = apiSuccess({ value: 42, label: "ok" }, { status: 201 });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      data: {
        value: 42,
        label: "ok",
      },
      value: 42,
      label: "ok",
    });
  });

  it("returns a standardized error envelope", async () => {
    const response = apiError("Something failed", 403, { details: "nope" });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: "Something failed",
      details: "nope",
    });
  });
});
