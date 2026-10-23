import { test, expect } from "@playwright/test";
test("integración sin configurar permanece cerrada y conserva la demostración", async ({
  page,
}) => {
  const response = await page.goto("/sistema");
  await expect(
    page.getByRole("heading", {
      name: "Integración pendiente de configuración",
    }),
  ).toBeVisible();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await page.goto("/sistema/login");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión segura" }),
  ).toHaveCount(0);
  await expect(page.locator("main")).toContainText(
    "No se enviaron credenciales ni se contactó a Supabase.",
  );
  const image = await page.request.get(
    "/sistema/10000000-0000-4000-8000-000000000001/media/archivo?path=../private",
  );
  expect(image.status()).toBe(404);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¡Bienvenido a tus elecciones escolares!" }),
  ).toBeVisible();
});

test("portada institucional y demostración quedan separadas", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¡Bienvenido a tus elecciones escolares!" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Estudiante ficticio");
  await expect(page.getByRole("link")).toHaveCount(2);
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:test.info().outputPath("entrada-azul-pc.png"),fullPage:true,animations:"disabled"});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:test.info().outputPath("entrada-azul-movil.png"),fullPage:true,animations:"disabled"});

  await page
    .getByRole("link", { name: /Ingresar si eres organizador/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Integración pendiente de configuración",
    }),
  ).toBeVisible();
  await page.goto("/demostracion");
  await expect(
    page.getByRole("heading", { name: "Tu escuela. Tu voz. Tu elección." }),
  ).toBeVisible();
  await expect(
    page.getByText("Datos ficticios. No se registran votos oficiales."),
  ).toBeVisible();
});

test("mesa presencial deshabilitada no solicita DNI ni habilitaciones", async ({
  page,
}) => {
  await page.goto("/sistema/mesa");
  await expect(
    page.getByRole("heading", { name: "Votación presencial deshabilitada" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
