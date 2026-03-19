import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const { mockRequireAuth, mockCanAccess } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockCanAccess: vi.fn(),
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: mockRequireAuth,
  canAccess: mockCanAccess,
}));

import { exportToExcel } from "@/lib/actions/reports/export";

describe("reports export workbook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", active: true });
    mockCanAccess.mockResolvedValue(true);
  });

  it("exports a coverage workbook with the expected sheets", async () => {
    const result = await exportToExcel(
      {
        dailyCoverage: [
          {
            date: "2026-03-01",
            availableStaff: 5,
            totalStaff: 8,
            percentage: 62.5,
            status: "Good",
          },
        ],
        summary: {
          totalStaff: 8,
          averageAvailability: 62.5,
          peakAvailability: { count: 5, date: "2026-03-01" },
          lowAvailability: { count: 2, date: "2026-03-02" },
        },
      },
      "coverage"
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        filename: expect.stringMatching(/coverage-report-.*\.xlsx$/),
      })
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(result.data!, "base64") as any);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Daily Coverage",
    ]);
    expect(workbook.getWorksheet("Daily Coverage")?.getCell("A2").value).toBe(
      "Mar 01, 2026"
    );
  });
});
