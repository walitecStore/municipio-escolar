import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { makeDemoWorkbook } from "../src/lib/roll/excel";

test("importa 230 filas con vista previa, corrige duplicados y bloquea edición", async ({
  page,
}) => {
  await page.goto("/padron");
  await expect(
    page.getByRole("heading", { name: "I.E. ESTEBAN PAVLETICH TRUJILLO" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Distribución por grado y sección" })
      .locator("tbody tr"),
  ).toHaveCount(5);
  const file = {
    name: "padron-ficticio.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await makeDemoWorkbook()),
  };
  await page.getByLabel("Importar Excel ficticio").setInputFiles(file);
  await expect(
    page.getByRole("heading", { name: "230 registros válidos para revisar" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar reemplazo ficticio" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Importación ficticia confirmada",
  );
  await page
    .getByRole("button", { name: "Corregir DEMO-001", exact: true })
    .click();
  await page.getByLabel("Código", { exact: true }).fill("DEMO-002");
  await page
    .getByRole("button", { name: "Guardar corrección ficticia" })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Código duplicado",
  );
  await page.getByLabel("Código", { exact: true }).fill("DEMO-001");
  await page.getByLabel("Grado del registro").selectOption("5");
  await page.getByLabel("Sección del registro").selectOption("C");
  await page
    .getByRole("button", { name: "Guardar corrección ficticia" })
    .click();
  const row = page
    .getByRole("table", { name: "Padrón de estudiantes" })
    .getByRole("row")
    .filter({ hasText: "DEMO-001" });
  await expect(row).toContainText("5.º");
  await page.getByLabel("Filtrar grado").selectOption("5");
  await page.getByLabel("Filtrar sección").selectOption("C");
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Simular cierre de edición" }).click();
  await expect(
    page.getByRole("button", { name: "Corregir DEMO-001", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Importar Excel ficticio")).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Importar Excel ficticio")).toBeEnabled();
});

test("rechaza Excel inválido y datos no ficticios sin reemplazar el padrón", async ({
  page,
}) => {
  await page.goto("/padron");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prueba");
  sheet.addRow(["codigo", "nombre", "grado", "seccion"]);
  sheet.addRow(["DEMO-001", "Estudiante ficticio 001", 1, "A"]);
  sheet.addRow(["DEMO-001", "Estudiante ficticio 002", 6, "D"]);
  const upload = async () =>
    page
      .getByLabel("Importar Excel ficticio")
      .setInputFiles({
        name: "invalido.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      });
  await upload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Código duplicado",
  );
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Grado o sección inválidos",
  );
  await expect(
    page.getByRole("button", { name: "Confirmar reemplazo ficticio" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("table", { name: "Padrón de estudiantes" })
      .locator("tbody tr"),
  ).toHaveCount(230);
  sheet.spliceRows(3, 1);
  sheet.getRow(2).getCell(1).value = "PRUEBA-001";
  sheet.getRow(2).getCell(2).value = "Persona de prueba";
  await upload();
  await expect(page.getByRole("status")).toContainText(
    "El modo público solo acepta",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
