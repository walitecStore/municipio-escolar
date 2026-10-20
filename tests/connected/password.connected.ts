import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:54329";
async function save(
  page: Page,
  confirmation = "Frase-ficticia2026!",
  otp?: string,
) {
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Frase-ficticia2026!");
  await page
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill(confirmation);
  if (otp) await page.getByLabel("Código actual del autenticador").fill(otp);
  await page
    .getByRole("button", {
      name: /Guardar contraseña|GUARDAR NUEVA CONTRASEÑA/,
    })
    .click();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test("token recovery de un uso, coincidencia y cambio sin conceder panel; nueva contraseña autentica", async ({
  page,
  request,
}) => {
  const { hash } = await (
    await request.post(`${fixture}/__test/recovery`)
  ).json();
  await page.goto(`/sistema/restablecer#type=recovery&token_hash=${hash}`);
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sistema\/restablecer$/);
  const recoveryCookies = (await page.context().cookies()).filter((c) =>
    c.name.startsWith("electoral-recovery"),
  );
  expect(recoveryCookies.length).toBeGreaterThan(0);
  expect(
    recoveryCookies.every(
      (c) =>
        c.httpOnly &&
        c.sameSite === "Lax" &&
        c.path === "/sistema/restablecer" &&
        c.expires < Date.now() / 1000 + 610,
    ),
  ).toBe(true);
  const panel = await page.context().newPage();
  await panel.goto("/sistema");
  await expect(panel).toHaveURL(/\/sistema\/login$/);
  await panel.close();
  await expect(
    page.getByRole("heading", { name: "CREAR NUEVA CONTRASEÑA" }),
  ).toBeVisible();
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("abcdefghijklmnop");
  await page
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("abcdefghijklmnop");
  await page
    .getByRole("button", { name: "Mostrar nueva contraseña", exact: true })
    .click();
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Ocultar nueva contraseña", exact: true })
    .click();
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "GUARDAR NUEVA CONTRASEÑA" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("mayúscula");
  await save(page, "Otra-frase2026!");
  await expect(page.locator("main [role=alert]")).toContainText("no coinciden");
  await save(page);
  await expect(page.getByRole("status")).toContainText(
    "Tu contraseña se actualizó correctamente",
  );
  expect(
    (await page.context().cookies()).some((c) =>
      c.name.startsWith("electoral-recovery"),
    ),
  ).toBe(false);
  await page.goto(`/sistema/restablecer#type=recovery&token_hash=${hash}`);
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "Solicita uno nuevo",
  );
  await page.goto("/sistema/login");
  await page
    .getByLabel("Correo de la cuenta autorizada")
    .fill("admin@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Frase-ficticia2026!");
  await page.getByRole("button", { name: "Iniciar sesión segura" }).click();
  await expect(page).toHaveURL(/\/sistema\/mfa$/);
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .passwordUpdates,
  ).toBe(1);
});
test("sesión de recuperación con factor existente exige TOTP nuevo y permanece aislada del panel", async ({
  page,
  request,
}) => {
  const { hash } = await (
    await request.post(`${fixture}/__test/recovery`, { data: { mfa: true } })
  ).json();
  await page.goto(`/sistema/restablecer#type=recovery&token_hash=${hash}`);
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await save(page, "Frase-ficticia2026!", "000000");
  await expect(page.locator("main [role=alert]")).toContainText("MFA inválido");
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .passwordUpdates,
  ).toBe(0);
  await save(page, "Frase-ficticia2026!", "123456");
  await expect(page.getByRole("status")).toContainText(
    "Tu contraseña se actualizó correctamente",
  );
  await page.goto("/sistema");
  await expect(page).toHaveURL(/\/sistema\/login$/);
});
test("enlace implícito legado a Site URL se procesa sin dejar tokens en URL; rechaza sesión normal y OTP antiguo", async ({
  page,
  request,
}) => {
  for (const scenario of [
    { mode: "ordinary" },
    { mode: "implicit", age: 601 },
  ]) {
    const tokens = await (
      await request.post(`${fixture}/__test/recovery`, { data: scenario })
    ).json();
    await page.goto(
      `/#type=recovery&access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
    );
    await page
      .getByRole("button", { name: "Verificar enlace de recuperación" })
      .click();
    await expect(page.locator("main [role=alert]")).toContainText(
      "Solicita uno nuevo",
    );
    await expect(page).toHaveURL(/\/sistema\/restablecer$/);
  }
  const tokens = await (
    await request.post(`${fixture}/__test/recovery`, {
      data: { mode: "implicit" },
    })
  ).json();
  await page.goto(
    `/#type=recovery&access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
  );
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test("solicitud genérica y canje PKCE usa cookie verifier del mismo navegador", async ({
  page,
  request,
}) => {
  await page.goto("/sistema/restablecer");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page
    .getByRole("button", { name: "RESTABLECER CONTRASEÑA", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Si el correo está registrado",
  );
  await page.goto("/sistema/restablecer?code=local-pkce-code");
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toBeVisible();
  await save(page);
  await expect(page.getByRole("status")).toContainText(
    "Tu contraseña se actualizó correctamente",
  );
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .recoverRequests,
  ).toBe(1);
});
test("cambio desde perfil exige contraseña actual y MFA reciente aun con AAL2", async ({
  page,
  request,
}) => {
  // Existing verified factor, independent of the password profile form.
  await request.post(`${fixture}/__test/recovery`, { data: { mfa: true } });
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
  await page.getByRole("link", { name: "Perfil · Cambiar contraseña" }).click();
  await page.getByLabel("Contraseña actual").fill("incorrecta");
  await save(page, "Frase-ficticia2026!", "123456");
  await expect(page.locator("main [role=alert]")).toContainText(
    "identidad reciente",
  );
  await page.getByLabel("Contraseña actual").fill("solo-prueba-local");
  await save(page, "Frase-ficticia2026!", "000000");
  await expect(page.locator("main [role=alert]")).toContainText("MFA inválido");
  await page.getByLabel("Contraseña actual").fill("solo-prueba-local");
  await save(page, "Frase-ficticia2026!", "123456");
  await expect(page.getByRole("status")).toContainText(
    "Tu contraseña se actualizó correctamente",
  );
  await page.goto("/sistema");
  await expect(page).toHaveURL(/\/sistema\/login$/);
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .passwordUpdates,
  ).toBe(1);
});

test("enlace vencido, sesión revocada y usuario ajeno no permiten actualizar; no filtra prueba por URL o headers", async ({
  page,
  request,
}) => {
  await page.goto("/#error=access_denied&error_code=otp_expired");
  await expect(
    page.getByRole("heading", { name: "RESTABLECER CONTRASEÑA" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "SOLICITAR NUEVO ENLACE" }),
  ).toBeVisible();
  for (const email of ["student@example.test", "admin@example.test"]) {
    const { hash } = await (
      await request.post(`${fixture}/__test/recovery`, { data: { email } })
    ).json();
    if (email.startsWith("admin"))
      await request.post(`${fixture}/__test/scenario`, {
        data: { rejectUsers: true },
      });
    let exposed = false;
    const inspect = (req: import("@playwright/test").Request) => {
      if (
        req.url().includes(hash) ||
        Object.values(req.headers()).some((value) => value.includes(hash))
      )
        exposed = true;
    };
    page.on("request", inspect);
    await page.goto(`/sistema/restablecer#type=recovery&token_hash=${hash}`);
    await page
      .getByRole("button", { name: "Verificar enlace de recuperación" })
      .click();
    await expect(page.locator("main [role=alert]")).toContainText(
      "Solicita uno nuevo",
    );
    await expect(
      page.getByLabel("Nueva contraseña", { exact: true }),
    ).toHaveCount(0);
    page.off("request", inspect);
    expect(exposed).toBe(false);
  }
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .passwordUpdates,
  ).toBe(0);
});
test("PKCE sin verifier y JWT alterado fallan cerrados", async ({
  page,
  request,
}) => {
  await page.goto("/sistema/restablecer?code=local-pkce-code");
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "Solicita uno nuevo",
  );
  const tokens = await (
    await request.post(`${fixture}/__test/recovery`, {
      data: { mode: "implicit" },
    })
  ).json();
  const [header, payload] = tokens.access_token.split(".");
  await page.goto(
    `/sistema/restablecer#type=recovery&access_token=${header}.${payload}.invalid&refresh_token=${tokens.refresh_token}`,
  );
  await page
    .getByRole("button", { name: "Verificar enlace de recuperación" })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "Solicita uno nuevo",
  );
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json())
      .passwordUpdates,
  ).toBe(0);
});
