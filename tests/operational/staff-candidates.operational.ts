import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
const fixture = "http://127.0.0.1:54329";
const id = "10000000-0000-4000-8000-000000000001";
async function login(
  page: Page,
  email = "admin@example.test",
  password = "solo-prueba-local",
) {
  await page.goto("/sistema/login");
  await page.getByLabel("Correo de la cuenta autorizada").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión segura" }).click();
  await page.getByRole("button", { name: "Preparar verificación MFA" }).click();
  await page.getByLabel("Código del autenticador").fill("123456");
  await page.getByRole("button", { name: "Verificar segundo factor" }).click();
  await expect(
    page.getByRole("heading", { name: "Panel electoral" }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/scenario`, {
    data: { purpose: "official", supervisedDni: true },
  });
});
test("invitación privada de un uso, contraseña propia, MFA y revocación sin UUID", async ({
  page,
  browser,
  request,
}) => {
  await login(page);
  await page.goto("/sistema/instituciones");
  await page
    .getByLabel("Nombre y apellidos", { exact: true })
    .fill("Miembro ficticio del comité");
  await page
    .getByLabel("Correo de la persona")
    .fill("personal@invite.example.test");
  await page
    .getByRole("button", { name: "Generar invitación personal" })
    .click();
  let link = await page
    .getByLabel("Enlace privado de un solo uso")
    .inputValue();
  expect(link).toContain("/sistema/invitacion#token_hash=");
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .generatedInvites,
  ).toBe(1);
  const previous = link;
  await page.reload();
  await page
    .getByRole("button", { name: "Generar nuevo enlace", exact: true })
    .click();
  link = await page.getByLabel("Enlace privado de un solo uso").inputValue();
  expect(link).not.toBe(previous);
  const rejectedOld = await request.post(`${fixture}/auth/v1/verify`, {
    data: {
      type: "invite",
      token_hash: new URLSearchParams(new URL(previous).hash.slice(1)).get(
        "token_hash",
      ),
    },
  });
  expect(rejectedOld.status()).toBe(403);
  const context = await browser.newContext();
  const invited = await context.newPage();
  const requested: string[] = [];
  invited.on("request", (r) => requested.push(r.url()));
  await invited.goto(link);
  await expect(invited).toHaveURL(/\/sistema\/invitacion$/);
  expect(requested.some((url) => url.includes("token_hash"))).toBe(false);
  await invited
    .getByLabel("Tu nueva contraseña", { exact: true })
    .fill("Comite-Nueva-2026!");
  await invited.getByLabel("Repite tu contraseña").fill("Comite-Nueva-2026!");
  await invited
    .getByRole("button", { name: "Crear contraseña y activar mi cuenta" })
    .click();
  await expect(
    invited.getByRole("heading", { name: "Tu cuenta está lista" }),
  ).toBeVisible();
  await login(invited, "personal@invite.example.test", "Comite-Nueva-2026!");
  await invited.goto("/sistema/instituciones");
  await expect(
    invited.getByRole("button", { name: "Generar invitación personal" }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByLabel("Confirmo el cambio de acceso de esta persona.")
    .check();
  await page
    .getByRole("button", { name: "Revocar acceso", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Acceso revocado");
  await invited.goto(`/sistema/${id}/listas`);
  await expect(
    invited.getByRole("heading", { name: "Acceso electoral no disponible" }),
  ).toBeVisible();
  await invited.goto(link);
  await invited
    .getByLabel("Tu nueva contraseña", { exact: true })
    .fill("Otra-Clave-2026!");
  await invited.getByLabel("Repite tu contraseña").fill("Otra-Clave-2026!");
  await invited
    .getByRole("button", { name: "Crear contraseña y activar mi cuenta" })
    .click();
  await expect(invited.locator("main").getByRole("alert")).toContainText(
    "no es válida",
  );
  await context.close();
});
test("símbolo y foto se suben desde el registro, se vinculan y se muestran sin rutas manuales", async ({
  page,
  request,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/sistema/${id}/listas`);
  await page
    .getByRole("link", { name: "Registrar lista y símbolo", exact: true })
    .click();
  await page
    .getByLabel("Nombre de la lista o partido escolar")
    .fill("Lista ficticia con símbolo");
  await page.getByLabel("Número electoral").fill("2");
  await page
    .getByLabel("Propuestas (una por línea)")
    .fill("Propuesta ficticia para la escuela");
  const image = await sharp({
    create: { width: 120, height: 120, channels: 3, background: "#1255dd" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Subir símbolo de la lista").setInputFiles({
    name: "simbolo.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByAltText("Vista previa: Subir símbolo de la lista"),
  ).toBeVisible();
  await page.locator("#registrar-lista").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Registrar lista", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lista 2 · Lista ficticia con símbolo" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Símbolo electoral privado")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("link", { name: "Registrar candidato", exact: true })
    .click();
  await page
    .getByLabel("Nombres y apellidos del candidato")
    .fill("Candidato ficticio con imagen");
  await page
    .getByLabel("Lista de la candidatura")
    .selectOption({ label: "Lista ficticia con símbolo" });
  await page
    .getByLabel("Nombre del cargo", { exact: true })
    .fill("Alcaldía escolar");
  await page
    .getByLabel("Subir fotografía del candidato (opcional)")
    .setInputFiles({
      name: "candidato.png",
      mimeType: "image/png",
      buffer: image,
    });
  await page.locator("#registrar-candidato").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Registrar candidato", exact: true })
    .click();
  await expect(page.locator("main")).toContainText(
    "Candidato ficticio con imagen · Alcaldía escolar",
  );
  await expect(
    page.getByAltText("Fotografía autorizada de Candidato ficticio con imagen"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.calls.register_electoral_media).toBe(2);
  await page.screenshot({
    path: test.info().outputPath("registro-candidatos-movil.png"),
    fullPage: true,
  });
});

test("registro con alcalde o regidor sin números; conserva datos y archivo tras un rechazo", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/listas`);
  const form = page.locator("#registrar-candidato");
  await expect(
    form.getByRole("radio", { name: /Registrar regidor/ }),
  ).toBeChecked();
  await expect(
    form.getByRole("radio", { name: /Registrar alcalde/ }),
  ).toBeDisabled();
  await expect(form.locator('input[name="position"]')).toHaveCount(0);
  await form
    .getByLabel("Nombres y apellidos del candidato")
    .fill("Regidor ficticio uno");
  await form
    .getByRole("button", { name: "Registrar candidato", exact: true })
    .click();
  await expect(page.locator("main")).toContainText(
    "Regidor ficticio uno · Regiduría escolar",
  );
  await form
    .getByLabel("Nombres y apellidos del candidato")
    .fill("Regidor ficticio dos");
  await form
    .getByLabel("Subir fotografía del candidato (opcional)")
    .setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: Buffer.from("not a real image"),
    });
  await form.getByRole("checkbox").check();
  await form
    .getByRole("button", { name: "Registrar candidato", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "No se pudo guardar la fotografía",
  );
  await expect(
    form.getByLabel("Nombres y apellidos del candidato"),
  ).toHaveValue("Regidor ficticio dos");
  await expect(form.getByRole("checkbox")).toBeChecked();
  expect(
    await form
      .getByLabel("Subir fotografía del candidato (opcional)")
      .evaluate((input: HTMLInputElement) => input.files?.length),
  ).toBe(1);
  let stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.manage_electoral_candidate).toBe(1);
  const image = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#1566bb" },
  })
    .png()
    .toBuffer();
  await form
    .getByLabel("Subir fotografía del candidato (opcional)")
    .setInputFiles({
      name: "foto-valida.png",
      mimeType: "image/png",
      buffer: image,
    });
  await form
    .getByRole("button", { name: "Registrar candidato", exact: true })
    .click();
  await expect(page.locator("main")).toContainText(
    "Regidor ficticio dos · Regiduría escolar",
  );
  stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.manage_electoral_candidate).toBe(2);
  expect(stats.calls.register_electoral_media).toBe(1);
});
