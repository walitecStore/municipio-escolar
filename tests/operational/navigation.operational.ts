import { test, expect, type Page } from "@playwright/test";
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
    page.getByRole("heading", { name: "Panel electoral" }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/scenario`, {
    data: { purpose: "official", supervisedDni: true },
  });
});
test("tarjetas únicas, navegación atrás estable y distribución de PC/tableta/celular", async ({
  page,
  request,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/sistema/${id}`);
  const cards = page.locator("main .module-card");
  await expect(cards).toHaveCount(7);
  const hrefs = await cards.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("href")),
  );
  expect(new Set(hrefs).size).toBe(7);
  await expect(
    page.getByRole("navigation", { name: "Navegación de la elección" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "¡Hola, comité electoral!" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".welcome-illustration")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: test.info().outputPath("interfaz-pc.png"),
    fullPage: true,
  });
  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("interfaz-movil.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: /Padrón electoral Importa/ }).click();
  await expect(
    page.getByRole("heading", { name: "Padrón electoral · 2026" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Volver a la elección" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Volver a la elección" }).click();
  await expect(page).toHaveURL(new RegExp(`/sistema/${id}$`));
  await request.post(`${fixture}/__test/scenario`, {
    data: { supervisedDni: false },
  });
  await page.reload();
  await expect(page.locator("main .module-card")).toHaveCount(8);
  await page.getByRole("link", { name: /Mesas · DNI Prepara/ }).click();
  await expect(
    page.getByRole("heading", { name: "Votación presencial con DNI" }),
  ).toBeVisible();
  await page.goto(`/sistema/${id}/configuracion`);
  const checkbox = page.getByRole("checkbox");
  expect((await checkbox.boundingBox())?.width).toBeLessThanOrEqual(25);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Más", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Más", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "Más", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("link", { name: "Perfil y seguridad" }).click();
  await expect(
    page.getByRole("heading", { name: "Cambiar contraseña" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Volver al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Panel electoral" }),
  ).toBeVisible();
});
test("actas protegidas antes del cierre; PDF separado de resultados y acceso de electores denegado", async ({
  page,
  request,
  browser,
}) => {
  await login(page);
  await page.goto(`/sistema/${id}/actas`);
  await expect(
    page.getByRole("heading", { name: "Actas disponibles después del cierre" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar acta del recuento" }),
  ).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json()).calls
      .get_electoral_results ?? 0,
  ).toBe(0);
  await request.post(`${fixture}/__test/scenario`, {
    data: { state: "closed" },
  });
  await page.goto(`/sistema/${id}/resultados`);
  await expect(
    page.getByRole("heading", { name: "Resultados electorales" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar acta del recuento" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Actas y documentos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Actas y documentos" }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar acta del recuento" })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("recuento-cerrado.pdf");
  const path = await download.path();
  expect((await readFile(path!)).subarray(0, 4).toString()).toBe("%PDF");
  const context = await browser.newContext();
  const student = await context.newPage();
  await student.goto("http://127.0.0.1:3104/sistema/login");
  await student
    .getByLabel("Correo de la cuenta autorizada")
    .fill("student@example.test");
  await student
    .getByLabel("Contraseña", { exact: true })
    .fill("solo-prueba-local");
  await student.getByRole("button", { name: "Iniciar sesión segura" }).click();
  await expect(student).toHaveURL("http://127.0.0.1:3104/sistema");
  await student.goto(`http://127.0.0.1:3104/sistema/${id}/actas`);
  await expect(
    student.getByRole("heading", { name: "Acceso electoral no disponible" }),
  ).toBeVisible();
  await expect(
    student.getByRole("button", { name: "Descargar acta del recuento" }),
  ).toHaveCount(0);
  await context.close();
});
test("movimiento reducido y ayuda accesible desde la navegación móvil", async ({
  page,
}) => {
  await login(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/sistema/${id}`);
  await expect(page.locator(".welcome-illustration")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Ayuda", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ayuda para tu proceso electoral" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Volver al inicio" }),
  ).toBeVisible();
});
