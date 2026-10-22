"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { mutationOrigin, verifiedSession } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
export type InstitutionState = { message?: string; error?: string };
export async function institutionAction(
  _: InstitutionState,
  form: FormData,
): Promise<InstitutionState> {
  try {
    await mutationOrigin();
    const { client, session } = await verifiedSession();
    if (!isStaff(session)) throw new Error();
    const op = String(form.get("operation"));
    let response;
    const iid = () => z.string().uuid().parse(form.get("institution"));
    const name = () =>
      z.string().trim().min(1).max(160).parse(form.get("name"));
    const expected = () =>
      z.coerce.number().int().min(1).max(10000).parse(form.get("expected"));
    if (op === "provision")
      response = await client.rpc("provision_institution", {
        p_name: name(),
        p_admin: z.string().uuid().parse(form.get("user")),
        p_expected: expected(),
      });
    else if (op === "update")
      response = await client.rpc("update_my_institution", {
        p_institution: iid(),
        p_name: name(),
        p_expected: expected(),
      });
    else if (op === "existing")
      response = await client.rpc("assign_existing_institution_staff", {
        p_institution: iid(),
        p_email: z
          .email()
          .max(254)
          .parse(
            String(form.get("email") ?? "")
              .trim()
              .toLowerCase(),
          ),
        p_role: z.enum(["administrator", "committee"]).parse(form.get("role")),
        p_active: form.get("active") === "yes",
      });
    else if (op === "staff")
      response = await client.rpc("assign_institution_staff", {
        p_institution: iid(),
        p_user: z.string().uuid().parse(form.get("user")),
        p_role: z.enum(["administrator", "committee"]).parse(form.get("role")),
        p_active: form.get("active") === "yes",
      });
    else throw new Error();
    if (response.error) throw new Error();
    revalidatePath("/sistema/instituciones");
    return { message: "Cambios institucionales guardados." };
  } catch {
    return {
      error:
        "Operación rechazada. Comprueba MFA, permisos institucionales, cuenta Auth existente y migración 008. No se concede acceso a otras instituciones.",
    };
  }
}
