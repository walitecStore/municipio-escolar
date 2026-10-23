import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
export async function fillSlateWizard(
  page: Page,
  options: { candidate: string; party: string; regidors?: number; savedImages?: boolean },
) {
  const wizard = page.locator(".slate-wizard");
  await wizard
    .getByLabel("Nombres y apellidos del candidato", { exact: true })
    .fill(options.candidate);
  await wizard.getByLabel("Grado del candidato").selectOption("4");
  await wizard.getByLabel("Sección del candidato").selectOption("B");
  await wizard.getByRole("button", { name: "Siguiente", exact: true }).click();
  await wizard
    .getByLabel("Nombre del partido o agrupación escolar")
    .fill(options.party);
  await wizard
    .getByLabel("Propuestas del partido (una por línea)")
    .fill("Propuesta escolar ficticia");
  await wizard.getByRole("button", { name: "Siguiente", exact: true }).click();
  const buffer = await sharp({
    create: { width: 160, height: 160, channels: 3, background: "#236bd3" },
  })
    .png()
    .toBuffer();
  if (options.savedImages) {
    await wizard.getByRole("button", { name: "Usar imagen guardada", exact: true }).click();
    await wizard.getByRole("button", { name: "Usar esta imagen", exact: true }).first().click();
  } else await wizard.getByLabel("Foto del candidato", { exact: true }).setInputFiles({ name: "foto-ficticia.png", mimeType: "image/png", buffer });
  await wizard.getByRole("button", { name: "Siguiente", exact: true }).click();
  if (options.savedImages) {
    await wizard.getByRole("button", { name: "Usar imagen guardada", exact: true }).click();
    await wizard.getByRole("button", { name: "Usar esta imagen", exact: true }).first().click();
  } else await wizard.getByLabel("Símbolo del partido", { exact: true }).setInputFiles({ name: "simbolo-ficticio.png", mimeType: "image/png", buffer });
  await wizard
    .getByRole("checkbox", {
      name: "Tengo autorización institucional para utilizar la foto y el símbolo.",
    })
    .check();
  await wizard.getByRole("button", { name: "Siguiente", exact: true }).click();
  for (let n = 1; n <= (options.regidors ?? 2); n++) {
    await expect(
      wizard.getByRole("heading", {
        name: `Registra al regidor ${n}`,
        exact: true,
      }),
    ).toBeVisible();
    await wizard
      .getByLabel("Nombres y apellidos del regidor", { exact: true })
      .fill(`Regidor ficticio ${n}`);
    await wizard.getByLabel("Grado del regidor").selectOption("3");
    await wizard.getByLabel("Sección del regidor").selectOption("A");
    await wizard
      .getByLabel("Cargo del regidor", { exact: true })
      .fill(`Regiduría ficticia ${n}`);
    if (n < (options.regidors ?? 2))
      await wizard
        .getByRole("button", { name: "Siguiente regidor", exact: true })
        .click();
  }
}
