import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
const fixture = "http://127.0.0.1:54329";
const id = "10000000-0000-4000-8000-000000000001";
async function login(page: Page) {
  await page.goto("/sistema/login");
  await page
    .getByLabel("Correo de la cuenta autorizada")
    .fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("solo-prueba-local");
  await page.getByRole("button", { name: "Iniciar sesión segura" }).click();
  await page.getByRole("button", { name: "Preparar verificación MFA" }).click();
  await page.getByLabel("Código del autenticador").fill("123456");
  await page.getByRole("button", { name: "Verificar segundo factor" }).click();
  await expect(
    page.getByRole("heading", { name: "Panel electoral", exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/scenario`, {
    data: { purpose: "official", supervisedDni: true },
  });
});
test("directorio privado: búsqueda, filtros y plantilla Excel vacía utilizable", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/padron`);
  const directory = page.getByRole("table", {
    name: "Padrón electoral",
    exact: true,
  });
  await expect(directory.locator("tbody tr")).toHaveCount(230);
  await page.getByLabel("Buscar estudiante").fill("ESTUDIÁNTE FICTÍCIO 001");
  await expect(directory.locator("tbody tr")).toHaveCount(1);
  await expect(directory).toContainText("DEMO-001");
  await page.getByLabel("Buscar estudiante").fill("DEMO-002");
  await expect(directory).toContainText("Estudiante ficticio 002");
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await page
    .locator(".directory-filters")
    .getByRole("combobox", { name: "Grado", exact: true })
    .selectOption("1");
  await page
    .locator(".directory-filters")
    .getByRole("combobox", { name: "Sección", exact: true })
    .selectOption("A");
  const rows = await directory.locator("tbody tr").allTextContents();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.includes("1.º") && row.includes("A"))).toBe(
    true,
  );
  await page.getByLabel("Buscar estudiante").fill("sin coincidencias");
  await expect(
    page.getByText("No encontramos coincidencias", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(directory.locator("tbody tr")).toHaveCount(230);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar plantilla Excel" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("plantilla-padron.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    new Uint8Array(await readFile((await download.path())!)).buffer,
  );
  const sheet = workbook.worksheets[0];
  expect([1, 2, 3, 4].map((c) => sheet.getRow(1).getCell(c).value)).toEqual([
    "dni",
    "nombre",
    "grado",
    "seccion",
  ]);
  expect(sheet.getColumn(1).numFmt).toBe("@");
  expect(sheet.actualRowCount).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: test.info().outputPath("padron-movil.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: test.info().outputPath("padron-pc.png"),
    fullPage: false,
  });
});
test("pantallas adaptables y estados honestos de habilitación", async ({
  page,
}) => {
  await login(page);
  for (const path of [
    "configuracion",
    "presencial",
    "listas",
    "candidatos",
    "media",
    "resultados",
    "actas",
  ]) {
    await page.goto(`/sistema/${id}/${path}`);
    await expect(page.locator("main h1")).toHaveCount(1);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ), `${path} at ${width}px`,
      ).toBe(true);
    }
    expect(await page.locator("main").innerText()).not.toMatch(
      /PostgreSQL|solicitud RPC|ENTORNO DE DEMOSTRACIÓN/,
    );
  }
  for (const path of ["instituciones", "perfil", "nueva", "preparacion"]) {
    await page.goto(`/sistema/${path}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("main h1")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByText("Modo oficial pendiente de habilitación", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Habilitar la aplicación no abre una elección", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("preparacion-movil.png"),
    fullPage: true,
  });
});
