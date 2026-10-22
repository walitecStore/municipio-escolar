"use server";
import { z } from "zod";
import { mutationOrigin } from "@/lib/connected/session";
import { supabaseServer } from "@/lib/connected/client";
import { passwordError } from "@/lib/connected/password-policy";
import { sessionSchema } from "@/lib/connected/policy";
export type AcceptInvitationState = { error?: string; done?: boolean };
export async function acceptInvitationAction(
  _: AcceptInvitationState,
  form: FormData,
): Promise<AcceptInvitationState> {
  try {
    await mutationOrigin();
    const password = String(form.get("password") ?? "");
    const error = passwordError(
      password,
      String(form.get("confirmation") ?? ""),
    );
    if (error) return { error };
    const token = z
      .string()
      .regex(/^[a-fA-F0-9]{40,128}$/)
      .parse(form.get("token"));
    const client = await supabaseServer();
    // Explicit submission only: no GET token consumption and no token in query strings.
    const result = await client.auth.verifyOtp({
      type: "invite",
      token_hash: token,
    });
    if (result.error || !result.data.user)
      return {
        error:
          "La invitación no es válida, venció o ya fue utilizada. Contacta al administrador.",
      };
    const user = await client.auth.getUser();
    const context = await client.rpc("get_electoral_session");
    const session = sessionSchema.safeParse(context.data);
    if (
      user.error ||
      user.data.user?.id !== result.data.user.id ||
      context.error ||
      !session.success ||
      !["administrator", "committee"].includes(session.data.role)
    ) {
      await client.auth.signOut();
      return {
        error:
          "Este acceso ya no está autorizado. Contacta al administrador de tu institución.",
      };
    }
    const changed = await client.auth.updateUser({ password });
    await client.auth.signOut();
    if (changed.error)
      return {
        error:
          "La invitación se verificó, pero no se pudo guardar la contraseña. Usa Recuperar contraseña con tu correo.",
      };
    return { done: true };
  } catch {
    return {
      error:
        "No se pudo activar la cuenta. Comprueba el enlace y vuelve a intentarlo.",
    };
  }
}
