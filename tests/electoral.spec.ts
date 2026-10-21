import { test, expect, type Download } from "@playwright/test";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
async function bytes(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Descarga sin contenido");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test("gestiona listas y regidores, comparte cambios y bloquea edición al abrir", async ({
  page,
}) => {
  await page.goto("/administracion");
  await page.getByRole("button", { name: "Añadir lista ficticia" }).click();
  await page
    .getByLabel("Nombre de lista", { exact: true })
    .fill("Lista ficticia de prueba");
  await page
    .getByRole("button", { name: "Añadir regidor", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar lista ficticia" }).click();
  await expect(
    page.getByRole("table", { name: "Listas administradas" }),
  ).toContainText("Lista ficticia de prueba");
  await page
    .getByRole("link", { name: "Listas y candidatos", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Lista ficticia de prueba");
  await page
    .getByRole("link", { name: "Administración (demo)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simular apertura electoral" })
    .click();
  await expect(
    page.getByRole("button", { name: "Editar lista 4", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Padrón (demo)", exact: true }).click();
  await expect(page.getByLabel("Importar Excel ficticio")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Corregir DEMO-001", exact: true }),
  ).toBeDisabled();
});

test("credencial ficticia se muestra una vez, se recupera y se bloquea al participar", async ({
  page,
}) => {
  await page.goto("/administracion");
  await page
    .getByLabel("Confirmo una entrega individual supervisada de demostración")
    .check();
  await page
    .getByRole("button", { name: "Generar credencial ficticia", exact: true })
    .click();
  const first = await page
    .getByLabel("Token ficticio de entrega única")
    .inputValue();
  expect(first).toHaveLength(43);
  await page
    .getByRole("button", { name: "Confirmar entrega y ocultar" })
    .click();
  await expect(page.getByLabel("Token ficticio de entrega única")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Recuperar credencial ficticia" })
    .click();
  const second = await page
    .getByLabel("Token ficticio de entrega única")
    .inputValue();
  expect(second === first).toBe(false);
  await page
    .getByRole("button", { name: "Confirmar entrega y ocultar" })
    .click();
  await page
    .getByRole("button", { name: "Simular apertura electoral" })
    .click();
  await page
    .getByRole("button", { name: "Probar bloqueo por participación" })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar credencial ficticia" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Recuperación bloqueada: el elector ficticio ya participó."),
  ).toBeVisible();
});

test("resultados solo tras cierre simulado, PDF y Excel descargables con marcas de demostración", async ({
  page,
}) => {
  await page.goto("/resultados");
  await expect(
    page.getByRole("heading", {
      name: "Resultados bloqueados hasta el cierre",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar acta PDF ficticia" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Ir al panel administrativo" }).click();
  await page
    .getByRole("button", { name: "Simular apertura electoral" })
    .click();
  await page.getByRole("button", { name: "Simular cierre electoral" }).click();
  await page
    .getByRole("link", { name: "Consultar resultados", exact: true })
    .click();
  await expect(page.getByText("98 preferencias ficticias")).toBeVisible();
  const pdfEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar acta PDF ficticia" })
    .click();
  const pdf = await bytes(await pdfEvent);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
  const excelEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar resultados Excel ficticios" })
    .click();
  const excel = await bytes(await excelEvent);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(excel).buffer);
  expect(workbook.worksheets[0].getCell("A1").value).toBe(
    "DEMOSTRACIÓN - SIN VALIDEZ OFICIAL",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
