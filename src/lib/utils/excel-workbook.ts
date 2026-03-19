import { Workbook, type Worksheet } from "exceljs";

export function createWorkbook() {
  const workbook = new Workbook();
  workbook.creator = "Staff Portal";
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

export function setWorksheetWidths(
  worksheet: Worksheet,
  widths: Array<number | undefined>
) {
  worksheet.columns = widths.map((width) => ({ width }));
}

export function styleHeaderRow(worksheet: Worksheet, rowNumber = 1) {
  const row = worksheet.getRow(rowNumber);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

export async function workbookToBuffer(workbook: Workbook): Promise<Buffer> {
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}
