import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { exportRosterToExcel } from "@/lib/services/roster-export-service";

describe("roster-export-service", () => {
  it("creates the expected workbook structure", async () => {
    const buffer = await exportRosterToExcel(
      {
        roster: {
          id: "roster-1",
          name: "Weekly Roster",
          description: null,
          venueId: "venue-1",
          venueName: "Venue A",
          startDate: new Date("2026-03-01T00:00:00.000Z"),
          endDate: new Date("2026-03-07T00:00:00.000Z"),
          status: "DRAFT",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        shifts: [
          {
            id: "shift-1",
            date: new Date("2026-03-02T00:00:00.000Z"),
            startTime: "09:00",
            endTime: "17:00",
            breakMinutes: 30,
            position: "Bar",
            notes: "Opening shift",
            userId: "user-1",
            userName: "Alex Smith",
            userEmail: "alex@example.com",
          },
        ],
        staff: [
          {
            id: "user-1",
            firstName: "Alex",
            lastName: "Smith",
            email: "alex@example.com",
            role: "Staff",
            totalHours: 7.5,
            totalPay: null,
            shiftsCount: 1,
          },
        ],
        summary: {
          totalStaff: 1,
          totalShifts: 1,
          totalHours: 7.5,
          totalPay: null,
          dateRange: {
            start: new Date("2026-03-01T00:00:00.000Z"),
            end: new Date("2026-03-07T00:00:00.000Z"),
          },
        },
      },
      {
        format: "excel",
        includePayRates: false,
        groupByStaff: true,
        includeBreakdown: false,
        dateFormat: "yyyy-mm-dd",
      }
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Overview",
      "Shifts",
      "Staff Summary",
    ]);
    expect(workbook.getWorksheet("Overview")?.getCell("A2").value).toBe("Roster Name");
    expect(workbook.getWorksheet("Shifts")?.getCell("B2").value).toBe("Alex Smith");
  });
});
