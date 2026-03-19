import { describe, expect, it } from "vitest";
import { normalizePagination } from "@/lib/utils/pagination";

describe("normalizePagination", () => {
  it("applies defaults when page and limit are omitted", () => {
    expect(normalizePagination()).toEqual({
      page: 1,
      limit: 50,
      skip: 0,
      take: 50,
    });
  });

  it("clamps the page and limit to safe bounds", () => {
    expect(
      normalizePagination(
        { page: 0, limit: 999 },
        { defaultLimit: 25, maxLimit: 100 }
      )
    ).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
      take: 100,
    });
  });

  it("calculates skip from the requested page", () => {
    expect(
      normalizePagination({ page: 3, limit: 20 }, { defaultLimit: 25, maxLimit: 100 })
    ).toEqual({
      page: 3,
      limit: 20,
      skip: 40,
      take: 20,
    });
  });
});
