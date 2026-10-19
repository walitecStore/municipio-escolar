import { test } from "node:test";
import assert from "node:assert/strict";
import {
  submitVote,
  type AuthorizedRpc,
} from "../../src/lib/electoral/backend";
import { validateSlate, type Slate } from "../../src/lib/electoral/types";
import {
  makeDemoResults,
  exportResultsExcel,
  exportResultsPdf,
} from "../../src/lib/electoral/results";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
const slate: Slate = {
  id: "01",
  number: 1,
  name: "Lista ficticia",
  symbol: "Árbol",
  color: "#148065",
  motto: "Ejemplo",
  proposals: ["Ejemplo"],
  candidates: [
    {
      id: "1",
      name: "Alcalde ficticio",
      role: "alcalde",
      position: 0,
      title: "Alcaldía",
      grade: 4,
      section: "A",
      photo: "/candidatos/valeria.jpg",
    },
    {
      id: "2",
      name: "Regidor ficticio",
      role: "regidor",
      position: 1,
      title: "Regiduría",
      grade: 3,
      section: "B",
      photo: "/candidatos/mateo.jpg",
    },
  ],
};
test("validación de listas exige alcalde, regidor y secciones válidas", () => {
  assert.deepEqual(validateSlate(slate), []);
  assert.ok(validateSlate({ ...slate, candidates: [] }).length);
  assert.ok(
    validateSlate({
      ...slate,
      candidates: slate.candidates.map((c) => ({ ...c, grade: 6 })),
    }).length,
  );
});
test("errores de voto distinguen rechazo, reintento seguro y estado desconocido sin reenvíos", async () => {
  for (const mode of [
    "rejected",
    "retryable",
    "unknown",
    "registered",
  ] as const) {
    let sends = 0;
    const rpc: AuthorizedRpc = {
      async call<T>(name: string) {
        if (name === "cast_electoral_vote") {
          sends++;
          if (mode === "retryable")
            throw Object.assign(new Error("Fallo ficticio"), { code: "40001" });
          throw new Error("Fallo ficticio");
        }
        if (mode === "unknown") throw new Error("Sin conexión ficticia");
        return (mode === "registered") as T;
      },
    };
    assert.equal(
      await submitVote(rpc, "eleccion-ficticia", "token-ficticio", null),
      mode,
    );
    assert.equal(sends, 1);
  }
});
test("reportes de demostración contienen agregados, votos en blanco y archivos legibles", async () => {
  const results = makeDemoResults([slate]);
  assert.equal(results.voters, 108);
  assert.equal(results.blank, 10);
  assert.equal(results.lists[0].winner, true);
  const pdf = await exportResultsPdf(results, "Institución ficticia");
  assert.ok((await PDFDocument.load(pdf)).getPageCount());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exportResultsExcel(results));
  assert.equal(
    workbook.worksheets[0].getCell("A1").value,
    "DEMOSTRACIÓN - SIN VALIDEZ OFICIAL",
  );
});

test("fotografías: saneamiento elimina metadatos y rechaza formatos no admitidos", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: sharp } = await import("sharp");
  const { preparePrivateElectoralImage } =
    await import("../../src/lib/electoral/media");
  const image = await preparePrivateElectoralImage(
    await readFile("public/candidatos/valeria.jpg"),
    "10000000-0000-0000-0000-000000000001",
  );
  const metadata = await sharp(image.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.ok((metadata.width ?? 0) <= 800);
  assert.ok(image.path.endsWith(".webp"));
  await assert.rejects(
    preparePrivateElectoralImage(
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      ),
      "10000000-0000-0000-0000-000000000001",
    ),
  );
});
