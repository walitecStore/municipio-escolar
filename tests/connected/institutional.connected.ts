import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { makeDemoWorkbook } from "../../src/lib/roll/excel";
const fixture = "http://127.0.0.1:54329";
const id = "10000000-0000-4000-8000-000000000001";
async function staffLogin(page: Page) {
  await page.goto("/sistema/login");
  await page
    .getByLabel("Correo de la cuenta autorizada")
    .fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("solo-prueba-local");
  await page.getByRole("button", { name: "Iniciar sesión segura" }).click();
  await expect(page).toHaveURL(/\/sistema\/mfa$/);
  await page.getByRole("button", { name: "Preparar verificación MFA" }).click();
  await page.getByLabel("Código del autenticador").fill("123456");
  await page.getByRole("button", { name: "Verificar segundo factor" }).click();
  await expect(
    page.getByRole("heading", { name: "Panel electoral" }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test("preparar borrador institucional sin habilitar voto oficial permite gestionar el padrón", async ({
  page,
  request,
}) => {
  await staffLogin(page);
  await page.goto("/sistema/nueva");
  await page.getByLabel("Modalidad").selectOption("official");
  await page
    .getByLabel(
      "Confirmo que crear el borrador no autoriza ni abre la votación.",
    )
    .check();
  await page
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/sistema/${id}$`));
  await expect(
    page.getByText(/Aprobación de seguridad pendiente/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir votación" }),
  ).toHaveCount(0);
  await page.goto("/sistema/preparacion");
  await expect(page.locator("main")).toContainText(
    "Registro de votosHabilitado en la aplicación",
  );
  await expect(page.locator("main")).toContainText(
    "Modo oficial pendiente de habilitación",
  );
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "En preparación" })
      .locator("strong"),
  ).toHaveText("1");
  await page.goto(`/sistema/${id}/padron`);
  await page.getByLabel("Archivo Excel de estudiantes").setInputFiles({
    name: "padron-ficticio.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await makeDemoWorkbook()),
  });
  await page
    .getByLabel(
      "Confirmo el reemplazo completo y la revocación de credenciales previas.",
    )
    .check();
  await page
    .getByRole("button", { name: "Reemplazar padrón completo" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Importados" }),
  ).toContainText("Importados 230 registros");
  await expect(
    page.getByRole("navigation", { name: "Navegación de la elección" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Navegación institucional" }),
  ).toContainText("Panel electoral");
  await page.goto(`/sistema/${id}/resultados`);
  await expect(
    page.getByRole("heading", { name: "Resultados bloqueados" }),
  ).toBeVisible();
  await page.goto(`/sistema/${id}/votar`);
  await expect(page.locator("main")).toContainText(
    "La votación todavía no está disponible",
  );
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.calls.create_institutional_election).toBe(1);
  expect(state.calls.cast_electoral_vote ?? 0).toBe(0);
});
test("MFA sigue siendo obligatorio para preparar gestión institucional", async ({
  page,
}) => {
  await page.goto("/sistema/login");
  await page
    .getByLabel("Correo de la cuenta autorizada")
    .fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("solo-prueba-local");
  await page.getByRole("button", { name: "Iniciar sesión segura" }).click();
  await expect(page).toHaveURL(/\/sistema\/mfa$/);
  await page.goto("/sistema/nueva");
  await expect(page).toHaveURL(/\/sistema\/mfa$/);
  await expect(
    page.getByRole("button", { name: "Crear borrador", exact: true }),
  ).toHaveCount(0);
});

test("sin migración 005 no disfraza una prueba como elección institucional", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/scenario`, {
    data: { institutionalFunctionMissing: true },
  });
  await staffLogin(page);
  await page.goto("/sistema/nueva");
  await page.getByLabel("Modalidad").selectOption("official");
  await page
    .getByLabel(
      "Confirmo que crear el borrador no autoriza ni abre la votación.",
    )
    .check();
  await page
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "migración adicional 005",
  );
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json()).calls
      .manage_electoral_election ?? 0,
  ).toBe(0);
});

test("importación por grado agrega dos Excel con DNI sin reemplazar los registros anteriores", async ({
  page,
  request,
}) => {
  await staffLogin(page);
  await request.post(`${fixture}/__test/scenario`, {
    data: { purpose: "official", state: "draft", clearRoll: true },
  });
  await page.goto(`/sistema/${id}/padron`);
  await page.getByLabel("Tipo de importación").selectOption("append");
  for (let grade = 1; grade <= 2; grade++) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Ficticio");
    sheet.addRow(["dni", "nombre", "grado", "seccion"]);
    sheet.addRow([
      String(grade).padStart(8, "0"),
      `Estudiante ficticio ${grade}`,
      grade,
      "A",
    ]);
    await page.getByLabel("Archivo Excel de estudiantes").setInputFiles({
      name: `grado-ficticio-${grade}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    await page
      .getByLabel(
        "Confirmo que se agregarán registros sin reemplazar los existentes.",
      )
      .check();
    await page
      .getByRole("button", { name: "Agregar estudiantes al padrón" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Agregados" }),
    ).toContainText("Agregados 1 registros");
    await expect(
      page.getByRole("table", { name: "Padrón electoral" }),
    ).toContainText(`Estudiante ficticio ${grade}`);
    expect(
      (await (await request.get(`${fixture}/__test/state`)).json()).calls
        .append_electoral_dni_roll,
    ).toBe(grade);
  }
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Padrón electoral" }),
  ).toContainText("Estudiante ficticio 1");
  await expect(
    page.getByRole("table", { name: "Padrón electoral" }),
  ).toContainText("Estudiante ficticio 2");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.calls.append_electoral_dni_roll).toBe(2);
  expect(state.calls.replace_electoral_roll ?? 0).toBe(0);
});
