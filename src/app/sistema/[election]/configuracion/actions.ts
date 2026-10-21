"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mutationOrigin, protectedElection } from "@/lib/connected/session";
export async function institutionalSettingsAction(
  id: string,
  _: { message?: string; error?: string },
  form: FormData,
): Promise<{ message?: string; error?: string }> {
  try {
    await mutationOrigin();
    const { client, election } = await protectedElection(id, true);
    if (election.state !== "draft" || form.get("confirm") !== "yes")
      throw new Error();
    const result = await client.rpc("configure_institutional_election", {
      p_election: id,
      p_school: z.string().trim().min(1).max(160).parse(form.get("school")),
      p_expected: z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(form.get("expected")),
    });
    if (result.error)
      return {
        error:
          "No se pudo guardar. Comprueba la migración 007, MFA y que el total no sea menor que los alumnos registrados.",
      };
    revalidatePath(`/sistema/${id}`, "layout");
    return {
      message:
        "Configuración guardada. El padrón existente se conserva y la elección sigue en borrador.",
    };
  } catch {
    return {
      error:
        "Revisa los campos y tu acceso autorizado. Solo se configura antes de abrir la elección.",
    };
  }
}
