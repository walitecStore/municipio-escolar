import { classrooms, institution } from "../institution";
export type Elector = {
  code: string;
  name: string;
  grade: number;
  section: string;
  voted: boolean;
};
export type RollError = { row: number; message: string };
export type ImportResult = { students: Elector[]; errors: RollError[] };
export const MAX_ROWS = institution.expectedStudents;
export function normalizeGrade(value: unknown): number {
  const text = String(value ?? "").trim();
  const match = text.match(/^([1-5])(?:\s*\.?\s*[º°o])?$/i);
  return match ? Number(match[1]) : NaN;
}
export function validateRows(rows: unknown[][]): ImportResult {
  const errors: RollError[] = [];
  const students: Elector[] = [];
  const codes = new Set<string>();
  if (!rows.length)
    errors.push({ row: 1, message: "El archivo no contiene estudiantes." });
  if (rows.length > MAX_ROWS)
    errors.push({
      row: 1,
      message: `Máximo ${MAX_ROWS} estudiantes por padrón.`,
    });
  rows.forEach((row, i) => {
    const [rawCode, rawName, rawGrade, rawSection] = row;
    const code = String(rawCode ?? "")
      .trim()
      .toUpperCase();
    const name = String(rawName ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const grade = normalizeGrade(rawGrade);
    const section = String(rawSection ?? "")
      .trim()
      .toUpperCase();
    const rowNumber = i + 2;
    const add = (message: string) => errors.push({ row: rowNumber, message });
    if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code))
      add("Código obligatorio: 2 a 30 letras, números, guion o guion bajo.");
    if (codes.has(code)) add(`Código duplicado: ${code}.`);
    codes.add(code);
    if (!name || name.length > 120 || /^[=+@-]/.test(name))
      add("Nombre obligatorio de hasta 120 caracteres, sin fórmulas.");
    if (!classrooms.some((c) => c.grade === grade && c.section === section))
      add("Grado o sección inválidos: usa 1 a 5 y A, B o C.");
    students.push({ code, name, grade, section, voted: false });
  });
  return { students: errors.length ? [] : students, errors };
}
export function demoStudents(): Elector[] {
  return Array.from({ length: MAX_ROWS }, (_, i) => ({
    code: `DEMO-${String(i + 1).padStart(3, "0")}`,
    name: `Estudiante ficticio ${String(i + 1).padStart(3, "0")}`,
    ...classrooms[i % classrooms.length],
    voted: false,
  }));
}
export function isDemoOnly(students: Elector[]) {
  return students.every(
    (s) =>
      /^DEMO-\d{3}$/.test(s.code) && /^Estudiante ficticio \d{3}$/.test(s.name),
  );
}
export function rollSummary(students: Elector[]) {
  const voters = students.filter((s) => s.voted).length;
  return {
    total: students.length,
    voters,
    pending: students.length - voters,
    classrooms: classrooms.map((c) => ({
      ...c,
      count: students.filter(
        (s) => s.grade === c.grade && s.section === c.section,
      ).length,
    })),
  };
}
