import type { ElectoralResults, Slate } from "./types";
export function makeDemoResults(slates: Slate[]): ElectoralResults {
  const fakeVotes: Record<string, number> = { "01": 98, "02": 72, "03": 40 };
  const voters = slates.reduce((n, l) => n + (fakeVotes[l.id] ?? 0), 0) + 10;
  const highest = Math.max(0, ...slates.map((l) => fakeVotes[l.id] ?? 0));
  return {
    election_id: "DEMO-2026",
    state: "closed",
    electors: 230,
    voters,
    pending: 230 - voters,
    blank: 10,
    blank_percentage: (10 / voters) * 100,
    participation: (voters / 230) * 100,
    lists: slates.map((l) => ({
      id: l.id,
      number: l.number,
      name: l.name,
      votes: fakeVotes[l.id] ?? 0,
      percentage: ((fakeVotes[l.id] ?? 0) / voters) * 100,
      winner: highest > 0 && (fakeVotes[l.id] ?? 0) === highest,
    })),
  };
}
export async function exportResultsExcel(results: ElectoralResults) {
  if (results.state !== "closed") throw new Error("Elección no cerrada");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Resultados demostracion");
  sheet.addRow(["DEMOSTRACIÓN - SIN VALIDEZ OFICIAL"]);
  sheet.addRow([
    "Electores",
    results.electors,
    "Votantes",
    results.voters,
    "Pendientes",
    results.pending,
  ]);
  sheet.addRow(["Lista", "Nombre", "Votos", "Porcentaje sobre votos emitidos"]);
  for (const row of results.lists)
    sheet.addRow([
      row.number,
      row.name,
      row.votes,
      Number(row.percentage.toFixed(2)),
    ]);
  sheet.addRow([
    "",
    "En blanco",
    results.blank,
    Number(results.blank_percentage.toFixed(2)),
  ]);
  sheet.columns.forEach((c) => {
    c.width = 32;
  });
  return await workbook.xlsx.writeBuffer();
}
export async function exportResultsPdf(
  results: ElectoralResults,
  school: string,
) {
  if (results.state !== "closed") throw new Error("Elección no cerrada");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]),
    y = 790;
  function line(text: string, size = 11) {
    const safe = text
      .normalize("NFC")
      .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, "?");
    for (const part of safe.match(/.{1,85}/g) ?? [""]) {
      if (y < 55) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(part, {
        x: 40,
        y,
        size,
        font,
        color: rgb(0.08, 0.2, 0.34),
      });
      y -= size + 10;
    }
  }
  line("ACTA ELECTORAL DE DEMOSTRACION", 16);
  line("SIN VALIDEZ OFICIAL - DATOS FICTICIOS", 12);
  line(school);
  line(`Elección: ${results.election_id}`);
  line(
    `Electores: ${results.electors} | Votantes: ${results.voters} | Pendientes: ${results.pending}`,
  );
  line(`Participación: ${results.participation.toFixed(2)} %`);
  for (const row of results.lists)
    line(
      `Lista ${row.number}: ${row.name} - ${row.votes} votos (${row.percentage.toFixed(2)} %)`,
    );
  line(
    `En blanco: ${results.blank} (${results.blank_percentage.toFixed(2)} %)`,
  );
  const leaders = results.lists.filter((l) => l.winner);
  line(
    leaders.length > 1
      ? `Empate: ${leaders.map((l) => l.name).join(", ")}`
      : leaders.length
        ? `Mayor votación de lista: ${leaders[0].name}`
        : "Sin lista ganadora",
  );
  line("Porcentajes calculados sobre votos emitidos, incluidos blancos.");
  line("No constituye una proclamación ni un acta oficial firmada.");
  return doc.save();
}
