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
    page.getByRole("heading", { name: "Tu escuela. Tu voz. Tu elección." }),
  ).toBeVisible();
});
