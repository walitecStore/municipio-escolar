"use server";
import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mutationOrigin, protectedElection } from "@/lib/connected/session";
export type ControlState = { error?: string; token?: string; message?: string };
export async function controlAction(
  id: string,
  _: ControlState,
  form: FormData,
): Promise<ControlState> {
  try {
    await mutationOrigin();
    const { client, election } = await protectedElection(id, true);
    const op = String(form.get("operation"));
    if (op === "configure") {
      if (election.state !== "draft" || form.get("confirm") !== "yes")
        throw new Error();
      const r = await client.rpc("configure_supervised_dni", {
        p_election: id,
      });
      if (r.error) throw new Error();
    } else if (op === "create") {
      const token = randomBytes(48).toString("base64url");
      const r = await client.rpc("create_voting_station", {
        p_election: id,
        p_label: z.string().trim().min(1).max(40).parse(form.get("label")),
        p_hash: createHash("sha256").update(token).digest("hex"),
      });
      if (r.error) throw new Error();
      revalidatePath(`/sistema/${id}/presencial`);
      return {
        token,
        message:
          "Copia esta habilitación una sola vez en el navegador exclusivo de la mesa. Caduca en 8 horas. No la compartas ni la fotografíes.",
      };
    } else if (["approve", "cancel", "revoke"].includes(op)) {
      if (op === "approve" && form.get("confirm") !== "yes") throw new Error();
      const r = await client.rpc("manage_supervised_turn", {
        p_election: id,
        p_station: z.string().uuid().parse(form.get("station")),
        p_turn:
          op === "revoke" ? null : z.string().uuid().parse(form.get("turn")),
        p_approve: op === "approve",
        p_revoke: op === "revoke",
      });
      if (r.error) throw new Error();
    } else throw new Error();
    revalidatePath(`/sistema/${id}/presencial`);
    return { message: "Operación completada." };
  } catch {
    return {
      error:
        "Operación rechazada. Revisa MFA, estado, DNI del padrón y migración 006. No se ha habilitado la elección.",
    };
  }
}
