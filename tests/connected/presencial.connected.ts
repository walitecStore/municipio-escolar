import { test, expect } from "@playwright/test";
const fixture = "http://127.0.0.1:54329";
const id = "10000000-0000-4000-8000-000000000001";
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test("mesa exclusiva: habilitación, DNI, comprobación del comité, nombre, voto secreto y limpieza", async ({
  page,
  browser,
  request,
}) => {
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
    page.getByRole("heading", { name: "Panel electoral" }),
  ).toBeVisible();
  await page.goto(`/sistema/${id}/presencial`);
  await page
    .getByLabel("Confirmo la modalidad presencial supervisada.", {
      exact: false,
    })
    .check();
  await page.getByRole("button", { name: "Usar DNI presencial" }).click();
  await expect(page.getByLabel("Nombre del equipo")).toBeVisible();
  await page.getByLabel("Nombre del equipo").fill("Equipo ficticio 1");
  await page
    .getByRole("button", { name: "Crear habilitación de equipo" })
    .click();
  const token = await page
    .getByLabel("Habilitación privada (se muestra una vez)")
    .inputValue();
  expect(token).toMatch(/^[A-Za-z0-9_-]{64}$/);
  await page.goto("/sistema/mesa");
  await page.getByLabel("Habilitación del equipo (solo comité)").fill(token);
  await page
    .getByRole("button", { name: "Habilitar equipo", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "sin sesión administrativa",
  );
  await expect(
    page.getByLabel("Habilitación del equipo (solo comité)"),
  ).toBeVisible();
  await expect(page.getByLabel("DNI", { exact: true })).toHaveCount(0);
  // A clean browser context receives a station capability, never the staff session.
  const context = await browser.newContext();
  const booth = await context.newPage();
  await booth.goto("http://127.0.0.1:3102/sistema/mesa");
  await booth.getByLabel("Habilitación del equipo (solo comité)").fill(token);
  await booth
    .getByRole("button", { name: "Habilitar equipo", exact: true })
    .click();
  await request.post(`${fixture}/__test/scenario`, { data: { state: "open" } });
  await expect(booth.getByRole("heading", { name: "¡Bienvenido a tus elecciones escolares!" })).toBeVisible();
  await booth.getByRole("button", { name: "Entrar a mis elecciones" }).click();
  await booth.getByLabel("DNI", { exact: true }).fill("00000001");
  await booth.getByRole("button", { name: "Solicitar mi turno" }).click();
  await expect(
    booth.getByText("Espera la verificación presencial del comité."),
  ).toBeVisible();
  await expect(booth.getByText("Estudiante ficticio 001")).toHaveCount(0);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "electoral-station",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.path).toBe("/sistema/mesa");
  expect(cookie?.sameSite).toBe("Strict");
  expect(booth.url()).not.toContain(token);
  await page.goto(`/sistema/${id}/presencial`);
  await page
    .getByLabel("He comprobado presencialmente", { exact: false })
    .check();
  await page.getByRole("button", { name: "Autorizar turno" }).click();
  await booth
    .getByRole("button", { name: "Comprobar estado / autorización" })
    .click();
  await expect(
    booth.getByRole("heading", { name: "Estudiante ficticio 001" }),
  ).toBeVisible();
  // Approval in SQL is not sufficient to bypass the application's official-mode gate.
  await request.post(`${fixture}/__test/scenario`, {
    data: { purpose: "official", approved: true },
  });
  await booth
    .getByRole("button", { name: "Comprobar estado / autorización" })
    .click();
  await expect(booth.locator("main").getByRole("alert")).toContainText(
    "Operación no disponible",
  );
  await expect(booth.getByText("Estudiante ficticio 001")).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json()).ballots,
  ).toBe(0);
  await request.post(`${fixture}/__test/scenario`, {
    data: { purpose: "test", approved: false },
  });
  await booth
    .getByRole("button", { name: "Comprobar estado / autorización" })
    .click();
  await expect(
    booth.getByRole("heading", { name: "Estudiante ficticio 001" }),
  ).toBeVisible();
  await booth.getByLabel("Voto en blanco", { exact: true }).check();
  await booth.getByLabel("Confirmo mi selección.", { exact: false }).check();
  await booth.getByRole("button", { name: "Confirmar y emitir voto" }).click();
  await expect(
    booth.getByRole("heading", { name: "Participación registrada" }),
  ).toBeVisible();
  await expect(booth.getByText("Estudiante ficticio 001")).toHaveCount(0);
  await expect(booth.getByRole("heading", { name: "¡Gracias por tu voto!" })).toBeVisible();
  await booth.screenshot({ path: test.info().outputPath("gracias-voto.png"), fullPage: true });
  await booth
    .getByRole("button", { name: "Terminar y limpiar pantalla" })
    .click();
  await expect(booth.getByRole("heading", { name: "¡Gracias por tu voto!" })).toHaveCount(0);
  await booth.getByRole("button", { name: "Entrar a mis elecciones" }).click();
  await expect(booth.getByLabel("DNI", { exact: true })).toHaveValue("");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.ballots).toBe(1);
  await booth.goto(`http://127.0.0.1:3102/sistema/${id}/padron`);
  await expect(booth).toHaveURL(/\/sistema\/login$/);
  await context.close();
});
