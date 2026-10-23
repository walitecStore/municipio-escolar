import { fillSlateWizard } from "../fixtures/slate-ui";
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
test("asistente completo: atrás conserva los datos, no guarda antes de terminar y presenta foto/símbolo en galería", async ({
  page,
  request,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/sistema/${id}/listas`);
  await fillSlateWizard(page, {
    candidate: "Alcalde ficticio con foto",
    party: "Partido ficticio completo",
    regidors: 2,
  });
  let stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.register_electoral_slate ?? 0).toBe(0);
  expect(stats.media).toBe(0);
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await expect(
    page.getByLabel("Nombres y apellidos del regidor", { exact: true }),
  ).toHaveValue("Regidor ficticio 1");
  await page
    .getByRole("button", { name: "Siguiente regidor", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombres y apellidos del regidor", { exact: true }),
  ).toHaveValue("Regidor ficticio 2");
  await page
    .getByRole("button", { name: "Siguiente regidor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Terminar registro", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Candidato y plana registrados" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Mostrar candidatos", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Mostrar candidatos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Alcalde ficticio con foto",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Fotografía de Alcalde ficticio con foto")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByAltText("Símbolo de Partido ficticio completo"),
  ).toBeVisible();
  await page.getByText("Ver plana de regiduría · 2", { exact: true }).click();
  await expect(page.locator("main")).toContainText("Regidor ficticio 2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.register_electoral_slate).toBe(1);
  expect(stats.calls.register_electoral_media).toBe(2);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: test.info().outputPath("galeria-candidatos-movil.png"),
    fullPage: true,
  });
});

test("correcciones solo editan candidatos y agregan regidores; conservan datos tras un rechazo", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/listas`);
  await page
    .getByText("Corregir registros existentes", { exact: true })
    .click();
  const form = page.locator("#registrar-candidato");
  await expect(page.locator("#editar-partido")).toHaveCount(0);
  await expect(form.getByRole("radio")).toHaveCount(0);
  await expect(form.locator('input[name="role"]')).toHaveValue("regidor");
  await expect(form.getByRole("button", { name: "Eliminar candidatura" })).toHaveCount(0);
  await expect(form.locator('input[name="position"]')).toHaveCount(0);
  await form
    .getByLabel("Nombres y apellidos del candidato")
    .fill("Regidor ficticio uno");
  await form
    .getByRole("button", { name: "Agregar regidor", exact: true })
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
    .getByRole("button", { name: "Agregar regidor", exact: true })
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
    .getByRole("button", { name: "Agregar regidor", exact: true })
    .click();
  await expect(page.locator("main")).toContainText(
    "Regidor ficticio dos · Regiduría escolar",
  );
  stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.calls.manage_electoral_candidate).toBe(2);
  expect(stats.calls.register_electoral_media).toBe(1);
  const registered = form.locator("select").first();
  const mayorId = await registered.locator("option").nth(1).getAttribute("value");
  await registered.selectOption(mayorId!);
  await expect(form.locator('input[name="role"]')).toHaveValue("alcalde");
  await expect(form.getByLabel("Candidatura a la alcaldía")).toBeDisabled();
  await form.getByLabel("Nombres y apellidos del candidato").fill("Alcalde ficticio corregido");
  await form.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(registered).toContainText("Alcalde ficticio corregido");
  await registered.selectOption({ label: "Regidor ficticio uno · Regiduría escolar" });
  await expect(form.locator('input[name="role"]')).toHaveValue("regidor");
  await form.getByLabel("Nombre del cargo").fill("Regidor de educación");
  await form.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(registered).toContainText("Regidor ficticio uno · Regidor de educación");
});

test("galería presenta seis candidatos en dos filas y cuatro en dos columnas; no ofrece un asistente sin migración", async ({
  page,
  request,
}) => {
  await login(page);
  await request.post(`${fixture}/__test/scenario`, {
    data: { galleryCount: 6 },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/sistema/${id}/candidatos`);
  const cards = page.locator(".candidate-display-card");
  await expect(cards).toHaveCount(6);
  await expect.poll(async () => {
    const bounds = await cards.evaluateAll(nodes => nodes.map(node => { const rect=node.getBoundingClientRect();return {top:rect.top,left:rect.left}; }));
    return [new Set(bounds.map(rect=>rect.top)).size,new Set(bounds.map(rect=>rect.left)).size];
  }).toEqual([2,3]);
  await page.screenshot({
    path: test.info().outputPath("galeria-seis-pc.png"),
    fullPage: true,
  });
  await request.post(`${fixture}/__test/scenario`, {
    data: { galleryCount: 4 },
  });
  await page.reload();
  await expect(cards).toHaveCount(4);
  await expect
    .poll(
      async () =>
        new Set(
          await cards.evaluateAll((nodes) =>
            nodes.map((n) => n.getBoundingClientRect().left),
          ),
        ).size,
    )
    .toBe(2);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await request.post(`${fixture}/__test/scenario`, {
    data: { slateMissing: true },
  });
  await page.goto(`/sistema/${id}/listas`);
  await expect(
    page.getByText("Registro guiado pendiente de actualización", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".slate-wizard")).toHaveCount(0);
});

test("rechazo conserva el asistente completo; respuesta perdida se confirma sin duplicar la inscripción", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/listas`);
  await fillSlateWizard(page, {
    candidate: "Candidato ficticio para reintento",
    party: "Partido ficticio para reintento",
    regidors: 1,
  });
  await request.post(`${fixture}/__test/scenario`, {
    data: { slateReject: true },
  });
  await page
    .getByRole("button", { name: "Terminar registro", exact: true })
    .click();
  await expect(page.locator(".slate-wizard").getByRole("alert")).toContainText(
    "No se guardó el registro",
  );
  await expect(
    page.getByLabel("Nombres y apellidos del regidor", { exact: true }),
  ).toHaveValue("Regidor ficticio 1");
  let stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.slateCount).toBe(0);
  await request.post(`${fixture}/__test/scenario`, {
    data: { slateReject: false, slateLost: true },
  });
  await page
    .getByRole("button", { name: "Terminar registro", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Candidato y plana registrados" }),
  ).toBeVisible();
  stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.slateCount).toBe(1);
  expect(stats.calls.register_electoral_slate).toBe(2);
});

test("biblioteca privada guarda imágenes y las reutiliza sin volver a subirlas", async ({ page, request }) => {
  await login(page);
  await page.goto(`/sistema/${id}/media`);
  await expect(page.locator(".election-tabs")).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Volver a la elección"})).toBeVisible();
  await expect(page.getByText("Aún no hay imágenes guardadas")).toBeVisible();
  const buffer = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#137d55" } }).png().toBuffer();
  await page.getByLabel("Foto o símbolo desde mi equipo").setInputFiles({ name: "imagen-ficticia.png", mimeType: "image/png", buffer });
  await page.getByLabel("Tengo autorización institucional para usar esta imagen.").check();
  await page.getByRole("button", { name: "Guardar en la biblioteca" }).click();
  await expect(page.getByRole("status").filter({hasText: "Imagen guardada"})).toBeVisible();
  await expect(page.locator(".library-item img")).toHaveCount(1);
  const src = await page.locator(".library-item img").getAttribute("src");
  await page.reload();
  await expect(page.locator(".library-item img")).toHaveCount(1);
  await expect.poll(() => page.locator(".library-item img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path: test.info().outputPath("biblioteca-imagenes.png"), fullPage: true});
  const privateList = await request.get(`/sistema/${id}/media/biblioteca`);
  expect(privateList.status()).toBe(403);
  const privateImage = await request.get(src!);
  expect(privateImage.status()).toBe(404);
  await page.goto(`/sistema/${id}/listas`);
  await fillSlateWizard(page, {candidate: "Alcalde de biblioteca ficticio", party: "Partido de biblioteca ficticio", savedImages: true});
  await page.getByRole("button", {name: "Terminar registro", exact:true}).click();
  await expect(page.getByRole("heading", {name:"Candidato y plana registrados"})).toBeVisible();
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.media).toBe(1);
  expect(state.calls.register_electoral_media).toBe(1);
  expect(state.calls.register_electoral_slate).toBe(1);
  await page.goto(`/sistema/${id}/listas`);
  await page.getByText("Corregir registros existentes", {exact:true}).click();
  const editor = page.locator("#registrar-candidato");
  const existing = editor.locator("select").first();
  const mayor = await existing.locator("option").nth(1).getAttribute("value");
  await existing.selectOption(mayor!);
  await editor.getByRole("button", {name:"Usar imagen guardada", exact:true}).click();
  await editor.getByRole("button", {name:"Usar esta imagen", exact:true}).click();
  await editor.getByRole("button", {name:"Guardar cambios", exact:true}).click();
  await expect(editor.getByRole("status")).toBeVisible();
  const updated = await (await request.get(`${fixture}/__test/state`)).json();
  expect(updated.media).toBe(1);
  expect(updated.calls.manage_electoral_candidate).toBe(1);
});
