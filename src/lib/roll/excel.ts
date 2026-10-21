import { Unzip, UnzipInflate } from "fflate";
import ExcelJS from "exceljs";
import { demoStudents, validateRows, type ImportResult } from "./model";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const headers = ["codigo", "nombre", "grado", "seccion"];

/** Validate expanded bytes incrementally before ExcelJS parses any workbook. */
function validateArchive(buffer: ArrayBuffer) {
  let entries = 0,
    total = 0;
  const limit = 2 * 1024 * 1024;
  const fail = () =>
    new Error("Excel inválido o supera los límites de tamaño expandido.");
  try {
    const zip = new Unzip((file) => {
      if (
        ++entries > 128 ||
        (file.originalSize ?? 0) > limit ||
        file.name.includes("..") ||
        (!file.name.endsWith("/") && !/\.(xml|rels)$/i.test(file.name))
      )
        throw fail();
      let expanded = 0;
      file.ondata = (error, data) => {
        if (error) throw fail();
        expanded += data.length;
        total += data.length;
        if (expanded > limit || total > 8 * 1024 * 1024) throw fail();
      };
      file.start();
    });
    zip.register(UnzipInflate);
    const input = new Uint8Array(buffer);
    for (let offset = 0; offset < input.length; offset += 4096)
      zip.push(
        input.subarray(offset, offset + 4096),
        offset + 4096 >= input.length,
      );
    if (!entries) throw fail();
  } catch {
    throw fail();
  }
}

export async function readRollExcel(
  buffer: ArrayBuffer,
  options: { allowDni?: boolean } = {},
): Promise<ImportResult> {
  if (buffer.byteLength > MAX_FILE_BYTES)
    throw new Error("El archivo supera 2 MB.");
  validateArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length !== 1)
    throw new Error("El libro debe contener una sola hoja.");
  const sheet = workbook.worksheets[0];
  const dni =
    String(sheet.getRow(1).getCell(1).value ?? "")
      .trim()
      .toLowerCase() === "dni";
  const expectedHeaders =
    dni && options.allowDni ? ["dni", "nombre", "grado", "seccion"] : headers;
  if (
    sheet.actualColumnCount !== 4 ||
    !expectedHeaders.every(
      (h, i) =>
        String(sheet.getRow(1).getCell(i + 1).value ?? "")
          .trim()
          .toLowerCase() === h,
    )
  )
    throw new Error(
      options.allowDni
        ? "Encabezados: dni, nombre, grado, seccion (DNI como texto de 8 dígitos)."
        : "Encabezados requeridos: codigo, nombre, grado, seccion.",
    );
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
        if (
          dni &&
          column === 1 &&
          (typeof value !== "string" || !/^\d{8}$/.test(value.trim()))
        )
          throw new Error(
            `Fila ${number}: DNI obligatorio como texto de exactamente 8 dígitos; conserva ceros iniciales.`,
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
