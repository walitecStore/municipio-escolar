import ExcelJS from "exceljs";
import { demoStudents, validateRows, type ImportResult } from "./model";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const headers = ["codigo", "nombre", "grado", "seccion"];
export async function readRollExcel(
  buffer: ArrayBuffer,
): Promise<ImportResult> {
  if (buffer.byteLength > MAX_FILE_BYTES)
    throw new Error("El archivo supera 2 MB.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length !== 1)
    throw new Error("El libro debe contener una sola hoja.");
  const sheet = workbook.worksheets[0];
  if (
    sheet.actualColumnCount !== 4 ||
    !headers.every(
      (h, i) =>
        String(sheet.getRow(1).getCell(i + 1).value ?? "")
          .trim()
          .toLowerCase() === h,
    )
  )
    throw new Error("Encabezados requeridos: codigo, nombre, grado, seccion.");
  if (sheet.rowCount > 231)
    throw new Error("Máximo 230 estudiantes; elimina filas adicionales.");
  const rows: unknown[][] = [];
  for (let number = 2; number <= sheet.rowCount; number++) {
    const row = sheet.getRow(number);
    rows.push(
      [1, 2, 3, 4].map((column) => {
        const value = row.getCell(column).value;
        if (value !== null && typeof value === "object")
          throw new Error(
            `Fila ${number}: no se permiten fórmulas, enlaces ni celdas enriquecidas.`,
          );
        return value;
      }),
    );
  }
  return validateRows(rows);
}
export async function makeDemoWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Padron ficticio");
  sheet.addRow(headers);
  for (const s of demoStudents())
    sheet.addRow([s.code, s.name, s.grade, s.section]);
  sheet.columns.forEach((c) => {
    c.width = 30;
  });
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
