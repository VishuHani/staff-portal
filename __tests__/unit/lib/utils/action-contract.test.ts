import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  actionFailure,
  actionSuccess,
  revalidatePaths,
} from "@/lib/utils/action-contract";

describe("action-contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a consistent success envelope", () => {
    expect(actionSuccess({ value: 1 })).toEqual({
      success: true,
      value: 1,
    });
  });

  it("returns a consistent failure envelope", () => {
    expect(actionFailure("nope")).toEqual({
      success: false,
      error: "nope",
    });
  });

  it("deduplicates cache invalidation paths", () => {
    revalidatePaths("/a", "/b", "/a");

    expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(1, "/a");
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(2, "/b");
  });
});
