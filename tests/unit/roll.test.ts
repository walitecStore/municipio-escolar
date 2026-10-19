import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  demoStudents,
  validateRows,
  rollSummary,
  normalizeGrade,
  isDemoOnly,
} from "../../src/lib/roll/model";
import { readRollExcel, makeDemoWorkbook } from "../../src/lib/roll/excel";
import { prepareElectoralCredential } from "../../src/lib/security/credentials";

test("230 electores ficticios distribuidos en las 15 secciones, sin votos inventados", () => {
  const students = demoStudents();
  const summary = rollSummary(students);
  assert.equal(summary.total, 230);
  assert.equal(summary.voters, 0);
  assert.equal(summary.pending, 230);
  assert.equal(summary.classrooms.length, 15);
  assert.ok(summary.classrooms.every((c) => c.count >= 15));
  assert.equal(new Set(students.map((s) => s.code)).size, 230);
  assert.ok(isDemoOnly(students));
});
test("valida códigos normalizados, duplicados, campos, grados, secciones y capacidad sin importaciones parciales", () => {
  const good = validateRows([
    [" demo-001 ", "Estudiante ficticio 001", "1.º", " a "],
  ]);
  assert.equal(good.errors.length, 0);
  assert.equal(good.students[0].code, "DEMO-001");
  for (const grade of ["1", "1.º", "1°", "1º"])
    assert.equal(normalizeGrade(grade), 1);
  for (const grade of ["1abc", 0, 6, "primero"])
    assert.ok(Number.isNaN(normalizeGrade(grade)));
  const bad = validateRows([
    ["DEMO-001", "Nombre", 1, "A"],
    ["demo-001", "", 6, "D"],
  ]);
  assert.equal(bad.students.length, 0);
  assert.ok(bad.errors.some((e) => e.message.includes("duplicado")));
  assert.ok(bad.errors.some((e) => e.message.includes("Nombre")));
  assert.ok(bad.errors.some((e) => e.message.includes("Grado")));
  assert.ok(validateRows([]).errors.length);
  assert.ok(
    validateRows(
      Array.from({ length: 231 }, (_, i) => [`DEMO-${i}`, "Nombre", 1, "A"]),
    ).errors.some((e) => e.message.includes("Máximo")),
  );
});
test("Excel ficticio admite 230 registros y rechaza estructura incorrecta y fórmulas", async () => {
  const result = await readRollExcel(await makeDemoWorkbook());
  assert.equal(result.students.length, 230);
  assert.deepEqual(result.errors, []);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ejemplo");
  sheet.addRow(["codigo", "nombre", "grado", "seccion"]);
  sheet.addRow(["DEMO-001", { formula: "1+1" }, 1, "A"]);
  await assert.rejects(
    readRollExcel((await workbook.xlsx.writeBuffer()) as ArrayBuffer),
    /fórmulas/,
  );
  sheet.getRow(1).getCell(1).value = "dni";
  await assert.rejects(
    readRollExcel((await workbook.xlsx.writeBuffer()) as ArrayBuffer),
    /Encabezados/,
  );
});
test("credenciales aleatorias de 256 bits, distintas, hash unidireccional y caducidad", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  const a = prepareElectoralCredential(now);
  const b = prepareElectoralCredential(now);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(a.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.tokenHash, b.tokenHash);
  assert.equal(a.expiresAt.toISOString(), "2026-10-20T00:00:00.000Z");
});

test("Excel rechaza archivos comprimidos con expansión excesiva antes del parser", async () => {
  const { zipSync } = await import("fflate");
  const archive = zipSync(
    { "xl/worksheets/sheet1.xml": new Uint8Array(3 * 1024 * 1024) },
    { level: 9 },
  );
  await assert.rejects(
    readRollExcel(new Uint8Array(archive).buffer),
    /expandido/,
  );
});
