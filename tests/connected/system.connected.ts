import { makeDemoWorkbook } from "../../src/lib/roll/excel";
import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:54329";
const id = "10000000-0000-4000-8000-000000000001";
async function login(page: Page, email = "admin@example.test") {
  await page.goto("/sistema/login");
  await page.getByLabel("Correo de la cuenta autorizada").fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("solo-prueba-local");
  await page.getByRole("button", { name: "Iniciar sesión segura" }).click();
  if (email.startsWith("admin") || email.startsWith("committee")) {
    await expect(
      page.getByRole("heading", { name: "Verificación del comité" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Preparar verificación MFA" })
      .click();
    await expect(
      page.getByRole("img", {
        name: "QR privado para configurar tu autenticador",
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("img", {
            name: "QR privado para configurar tu autenticador",
          })
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.getByLabel("Código del autenticador").fill("123456");
    await page
      .getByRole("button", { name: "Verificar segundo factor" })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Panel electoral conectado" }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test("Auth SDK real, MFA, cookies HttpOnly y revocación verificadas en servidor", async ({
  page,
  request,
}) => {
  await login(page, "committee@example.test");
  await expect(page.locator("main")).toContainText("Comité electoral");
  const cookies = await page.context().cookies();
  expect(
    cookies.filter((c) => c.name.includes("auth-token")).length,
  ).toBeGreaterThan(0);
  expect(
    cookies
      .filter((c) => c.name.includes("auth-token"))
      .every((c) => c.httpOnly && c.sameSite === "Lax"),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.goto(`/sistema/${id}/padron`);
  await expect(
    page.getByRole("table", { name: "Padrón conectado" }).locator("tbody tr"),
  ).toHaveCount(230);
  await request.post(`${fixture}/__test/scenario`, {
    data: { rejectUsers: true },
  });
  await page.goto(`/sistema/${id}/padron`);
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión electoral" }),
  ).toBeVisible();
});
test("elector autenticado no puede leer padrón ni resultados; elección oficial bloqueada", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/scenario`, {
    data: { state: "open", purpose: "official", approved: true },
  });
  await login(page, "student@example.test");
  await page.goto(`/sistema/${id}/padron`);
  await expect(
    page.getByRole("heading", { name: "Acceso electoral no disponible" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "Estudiante ficticio 001",
  );
  await page.goto(`/sistema/${id}/resultados`);
  await expect(
    page.getByRole("heading", { name: "Acceso electoral no disponible" }),
  ).toBeVisible();
  await page.goto(`/sistema/${id}/votar`);
  await expect(page.locator("main")).toContainText("Emisión RPC deshabilitada");
  const stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.get_electoral_roll ?? 0).toBe(0);
  expect(stats.calls.cast_electoral_vote ?? 0).toBe(0);
});
test("entrega individual, voto con RPC y recuento real inaccesible hasta cierre", async ({
  page,
  browser,
  request,
}) => {
  await request.post(`${fixture}/__test/scenario`, { data: { state: "open" } });
  await login(page);
  await page.goto(`/sistema/${id}/credenciales`);
  await page
    .getByLabel(
      "He verificado al destinatario y supervisaré su entrega individual.",
    )
    .check();
  await page
    .getByRole("button", { name: "Emitir o recuperar credencial" })
    .click();
  const token = await page
    .getByLabel("Token individual de entrega")
    .inputValue();
  expect(token).toHaveLength(43);
  await page.getByLabel("Confirmo la entrega al elector correcto.").check();
  await page
    .getByRole("button", { name: "Confirmar entrega y retirar token" })
    .click();
  await expect(page.getByLabel("Token individual de entrega")).toHaveCount(0);
  const ctx = await browser.newContext();
  const student = await ctx.newPage();
  await login(student, "student@example.test");
  await student.goto(`http://127.0.0.1:3102/sistema/${id}/votar`);
  await student
    .getByRole("radio", { name: "Voto en blanco", exact: true })
    .check();
  await student.getByLabel("Credencial electoral individual").fill(token);
  await student
    .getByRole("button", { name: "Revisar antes de emitir" })
    .click();
  await student
    .getByRole("button", { name: "Confirmar y emitir solicitud RPC" })
    .click();
  await expect(student.getByRole("status").first()).toContainText(
    "Participación registrada",
  );
  await page.goto(`/sistema/${id}/resultados`);
  await expect(
    page.getByRole("heading", { name: "Resultados bloqueados" }),
  ).toBeVisible();
  let stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.get_electoral_results ?? 0).toBe(0);
  await request.post(`${fixture}/__test/scenario`, {
    data: { state: "closed" },
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Resultados de PostgreSQL" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Blancos: 1");
  stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.cast_electoral_vote).toBe(1);
  expect(stats.participation).toBe(true);
  await ctx.close();
});
test("subida saneada al Storage privado y respuesta de imagen sin caché pública", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/media`);
  await page
    .getByLabel("Fotografía autorizada")
    .setInputFiles("public/candidatos/valeria.jpg");
  await page
    .getByLabel("Confirmo que existe autorización documentada para este medio.")
    .check();
  await page
    .getByRole("button", { name: "Sanear y subir imagen privada" })
    .click();
  await expect(page.getByRole("status")).toContainText("Imagen saneada");
  const path = await page.locator("code").textContent();
  const image = await page.request.get(
    `/sistema/${id}/media/archivo?path=${encodeURIComponent(path!)}`,
  );
  expect(image.status()).toBe(200);
  expect(image.headers()["cache-control"]).toContain("no-store");
  expect(image.headers()["cross-origin-resource-policy"]).toBe("same-origin");
  expect(image.headers()["content-type"]).toContain("image/webp");
  const outsider = await request.get(
    `http://127.0.0.1:3102/sistema/${id}/media/archivo?path=${encodeURIComponent(path!)}`,
  );
  expect(outsider.status()).toBe(404);
});

test("formularios conectan importación, corrección, listas y candidatos a RPC de la sesión", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/padron`);
  await page.getByLabel("Excel para PostgreSQL").setInputFiles({
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
    .getByRole("button", { name: "Reemplazar padrón mediante RPC" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Importados 230 registros",
  );
  await page
    .getByLabel("Registro que se corregirá")
    .selectOption("40000000-0000-4000-8000-000000000001");
  await page
    .getByLabel("UUID de usuario creado manualmente en Supabase Auth")
    .fill("30000000-0000-4000-8000-000000000001");
  await page
    .getByRole("button", { name: "Guardar corrección y revocar credencial" })
    .click();
  await expect(page.getByRole("status").last()).toContainText(
    "Registro corregido",
  );
  await page.goto(`/sistema/${id}/listas`);
  await page
    .getByLabel("Nombre de lista", { exact: true })
    .fill("Lista ficticia HTTP");
  await page.getByLabel("Número electoral", { exact: true }).fill("2");
  await page
    .getByLabel("Propuestas (una por línea)")
    .fill("Propuesta ficticia HTTP");
  await page
    .getByRole("button", { name: "Guardar lista en PostgreSQL" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lista 2 · Lista ficticia HTTP" }),
  ).toBeVisible();
  await page
    .getByLabel("Lista de la candidatura", { exact: true })
    .selectOption({ label: "Lista ficticia HTTP" });
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Alcalde ficticio HTTP");
  await page.getByLabel("Cargo", { exact: true }).fill("Alcaldía escolar");
  await page
    .getByRole("button", { name: "Guardar candidatura en PostgreSQL" })
    .click();
  await expect(page.locator("main")).toContainText(
    "Alcalde ficticio HTTP · Alcaldía escolar",
  );
  const stats = await (await request.get(`${fixture}/__test/state`)).json();
  for (const name of [
    "replace_electoral_roll",
    "correct_electoral_student",
    "manage_electoral_list",
    "manage_electoral_candidate",
  ])
    expect(stats.calls[name]).toBe(1);
});
