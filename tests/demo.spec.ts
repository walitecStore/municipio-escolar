import { test, expect } from "@playwright/test";

test("las siete páginas, fotografías y navegación móvil funcionan", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "/",
    "/estudiantes",
    "/administracion",
    "/padron",
    "/candidatos",
    "/votacion",
    "/resultados",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByText("Datos ficticios. No se registran votos oficiales."),
    ).toBeVisible();
  }
  await page.goto("/");
  await page.screenshot({
    path: "test-results/inicio-escritorio.png",
    fullPage: true,
  });
  await page.goto("/candidatos");
  for (const photo of await page.locator("main img").all()) {
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/inicio-movil.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Conocer las listas", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("Listas y candidatos");
  expect(errors).toEqual([]);
});

test("el padrón filtra y el acceso aclara que no autentica", async ({
  page,
}) => {
  await page.goto("/padron");
  await page
    .getByRole("textbox", { name: "Buscar estudiantes ficticios" })
    .fill("Estudiante ficticio 001");
  await expect(
    page
      .getByRole("table", { name: "Padrón de estudiantes" })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Buscar estudiantes ficticios" })
    .fill("sin coincidencias");
  await expect(page.getByRole("status")).toContainText("No hay estudiantes");
  await page.goto("/estudiantes");
  await page.getByLabel("Código de estudiante ficticio").fill("EST-001");
  await page
    .getByRole("button", { name: "Probar acceso de demostración" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No se verificó tu identidad ni se inició una sesión",
  );
});

test("la selección no persiste ni envía votos y los resultados permanecen estáticos", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      mutations.push(request.url());
  });
  await page.goto("/votacion");
  await expect(
    page.getByRole("button", { name: "Confirmar selección de demostración" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: /LISTA 01/ }).check();
  await page
    .getByRole("button", { name: "Confirmar selección de demostración" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revisa tu selección" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Completar demostración" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No se ha emitido ni registrado ningún voto oficial",
  );
  await page.reload();
  await expect(page.getByRole("radio", { name: /LISTA 01/ })).not.toBeChecked();
  await page
    .getByRole("radio", { name: "Voto en blanco de demostración" })
    .check();
  await page
    .getByRole("button", { name: "Confirmar selección de demostración" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revisa tu selección" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Completar demostración" }).click();
  await expect(page.getByRole("status")).toContainText("Voto en blanco");
  await page.getByRole("button", { name: "Reiniciar demostración" }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar selección de demostración" }),
  ).toBeDisabled();
  await page.goto("/resultados");
  await expect(
    page.getByRole("heading", {
      name: "Resultados bloqueados hasta el cierre",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir al panel administrativo" }).click();
  await page
    .getByRole("button", { name: "Simular apertura electoral" })
    .click();
  await page.getByRole("button", { name: "Simular cierre electoral" }).click();
  await page
    .getByRole("link", { name: "Consultar resultados", exact: true })
    .click();
  await expect(page.getByText("98 preferencias ficticias")).toBeVisible();
  expect(mutations).toEqual([]);
});
