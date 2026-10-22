import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
const fixture = "http://127.0.0.1:54329";
const eid = "10000000-0000-4000-8000-000000000001";
async function login(page: Page, email = "admin@example.test") {
  await page.goto("/sistema/login");
  await page.getByLabel("Correo de la cuenta autorizada").fill(email);
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
test("interfaz pública operativa no muestra demostraciones ni permite rutas antiguas; PWA no guarda datos", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText(
    /demostración|datos ficticios|pruebas/i,
  );
  await expect(
    page.getByRole("button", { name: "Instalar aplicación" }),
  ).toBeVisible();
  for (const path of [
    "/demostracion",
    "/administracion",
    "/estudiantes",
    "/padron",
    "/candidatos",
    "/votacion",
    "/resultados",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sistema\/login$/);
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/sistema");
  expect(manifest.icons).toHaveLength(2);
  const worker = await (await request.get("/sw.js")).text();
  expect(worker).not.toMatch(
    /caches\.open|indexedDB|localStorage|sync\.register/,
  );
  expect(worker).toContain('event.request.method !== "GET"');
});
test("PWA sin internet informa sin conservar ni reenviar operaciones electorales", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.goto("/sistema");
  await expect(
    page.getByRole("heading", { name: "Necesitas conexión a internet" }),
  ).toBeVisible();
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  await context.setOffline(false);
});
test("el operador incorpora colegio, el encargado configura sus datos y prepara su propia elección", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/sistema/instituciones");
  const provision = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Registrar institución y encargado",
    }),
  });
  await provision
    .getByLabel("Nombre de la institución")
    .fill("Colegio ficticio independiente");
  await provision
    .getByLabel("UUID Auth del encargado")
    .fill("70000000-0000-4000-8000-000000000001");
  await provision.getByLabel("Electores previstos", { exact: true }).fill("17");
  await provision
    .getByRole("button", { name: "Registrar institución y encargado" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Colegio ficticio independiente",
      exact: true,
    }),
  ).toBeVisible();
  const context = await browser.newContext();
  const staff = await context.newPage();
  await login(staff, "school@example.test");
  await staff.goto("/sistema/instituciones");
  await expect(
    staff.getByRole("heading", { name: "Registrar otra institución" }),
  ).toHaveCount(0);
  await expect(
    staff.getByRole("heading", { name: "Colegio ficticio independiente" }),
  ).toBeVisible();
  await expect(
    staff.getByRole("heading", { name: "Institución ficticia de integración" }),
  ).toHaveCount(0);
  await staff
    .getByLabel("Nombre institucional")
    .fill("Colegio ficticio actualizado");
  await staff
    .getByLabel("Electores previstos para nuevas elecciones")
    .fill("18");
  await staff
    .getByRole("button", { name: "Guardar datos de la institución" })
    .click();
  await expect(
    staff.getByRole("heading", { name: "Colegio ficticio actualizado" }),
  ).toBeVisible();
  await staff.goto("/sistema/nueva");
  await expect(staff.getByLabel("Institución educativa")).toContainText(
    "Colegio ficticio actualizado",
  );
  await expect(staff.locator("body")).not.toContainText(
    /demostración|datos ficticios|Pruebas ·/i,
  );
  await staff.getByLabel("Total previsto de electores").fill("18");
  await staff
    .getByLabel(
      "Confirmo que crear el borrador no autoriza ni abre la votación.",
    )
    .check();
  await staff
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(staff).toHaveURL(new RegExp(`/sistema/${eid}$`));
  await expect(
    staff.getByRole("button", { name: "Abrir votación" }),
  ).toHaveCount(0);
  await staff.goto(`/sistema/${eid}/padron`);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Ficticio");
  sheet.addRow(["dni", "nombre", "grado", "seccion"]);
  sheet.addRow([1, "Estudiante ficticio", 1, "A"]);
  await staff.getByLabel("Archivo Excel de estudiantes").setInputFiles({
    name: "formato-invalido.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await staff
    .getByLabel(
      "Confirmo el reemplazo completo y la revocación de credenciales previas.",
    )
    .check();
  await staff
    .getByRole("button", { name: "Reemplazar padrón completo" })
    .click();
  await expect(staff.locator("main").getByRole("alert")).toContainText(
    "DNI obligatorio como texto de exactamente 8 dígitos",
  );
  await context.close();
});
