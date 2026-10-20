import { test, expect } from "@playwright/test";
const fixture = "http://127.0.0.1:54329";
let counter = 0;
test.beforeEach(async ({ request, context }) => {
  await request.post(`${fixture}/__test/reset`);
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `192.0.2.${100 + counter++}`,
  });
});
test("entrada directa sin enlace no muestra error y mantiene diseño móvil", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sistema/restablecer");
  await expect(
    page.getByRole("heading", { name: "RESTABLECER CONTRASEÑA" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Ingresa tu correo electrónico registrado para recibir un enlace de recuperación.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("proveedor acepta solicitud, redirect correcto y espera cliente/servidor incluso al recargar", async ({
  page,
  request,
}) => {
  await page.goto("/sistema/restablecer");
  await page
    .getByLabel("Correo electrónico")
    .fill("solicitud-unica@example.test");
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña",
  );
  await expect(
    page.getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true }),
  ).toBeDisabled();
  let stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.recoverRequests).toBe(1);
  expect(stats.recoveryRedirectValid).toBe(true);
  await page.reload();
  await page
    .getByLabel("Correo electrónico")
    .fill("SOLICITUD-UNICA@example.test");
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText("Espera");
  stats = await (await request.get(`${fixture}/__test/state`)).json();
  expect(stats.recoverRequests).toBe(1);
});
for (const mode of ["smtp", "rate", "configuration"]) {
  test(`fallo ${mode} no afirma envío ni muestra información privada`, async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__test/scenario`, {
      data: { recoveryProvider: mode },
    });
    await page.goto("/sistema/restablecer");
    await page
      .getByLabel("Correo electrónico")
      .fill(`fallo-${mode}@example.test`);
    await page
      .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
      .click();
    await expect(page.locator("main [role=alert]")).toContainText(
      mode === "rate" ? "límite" : "No se pudo procesar",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("sensitive-details");
    await expect(page.locator("main")).not.toContainText(
      "private-provider-detail",
    );
    expect(
      (await (await request.get(`${fixture}/__test/state`)).json())
        .recoverRequests,
    ).toBe(1);
  });
}
test("cuenta inexistente conserva respuesta neutral; email inválido no llega al proveedor", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/scenario`, {
    data: { recoveryProvider: "account" },
  });
  await page.goto("/sistema/restablecer");
  await page.getByLabel("Correo electrónico").fill("no-es-correo");
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .recoverRequests,
  ).toBe(0);
  await page
    .getByLabel("Correo electrónico")
    .evaluate((input) => input.setAttribute("type", "text"));
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "correo electrónico válido",
  );
  await page
    .getByLabel("Correo electrónico")
    .evaluate((input) => input.setAttribute("type", "email"));
  await page
    .getByLabel("Correo electrónico")
    .fill("sin-cuenta-ficticia@example.test");
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña",
  );
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});
test("enlace vencido permite volver al formulario y realizar nueva solicitud", async ({
  page,
  request,
}) => {
  await page.goto("/sistema/restablecer#type=recovery&error_code=otp_expired");
  await expect(page.locator("main [role=alert]")).toHaveText(
    "Este enlace ha vencido o ya fue utilizado. Solicita uno nuevo",
  );
  await page.getByRole("button", { name: "SOLICITAR NUEVO ENLACE" }).click();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  await page
    .getByLabel("Correo electrónico")
    .fill("reintento-enlace@example.test");
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Si el correo está registrado",
  );
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .recoverRequests,
  ).toBe(1);
});
