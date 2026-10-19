"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/connected/client";
import { mutationOrigin, verifiedSession } from "@/lib/connected/session";
import { sessionSchema } from "@/lib/connected/policy";
export type AuthState = {
  error?: string;
  qr?: string;
  factor?: string;
  challenge?: string;
  message?: string;
};
export async function loginAction(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  let destination = "/sistema";
  try {
    await mutationOrigin();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || email.length > 254 || !password || password.length > 1024)
      return { error: "Introduce tu cuenta y contraseña." };
    const client = await supabaseServer();
    const response = await client.auth.signInWithPassword({ email, password });
    if (response.error)
      return {
        error:
          "No se pudo iniciar sesión. Verifica tus datos o inténtalo más tarde.",
      };
    const context = await client.rpc("get_electoral_session");
    const parsed = sessionSchema.safeParse(context.data);
    if (context.error || !parsed.success || parsed.data.role === "unassigned") {
      await client.auth.signOut();
      return {
        error:
          "Cuenta sin acceso electoral o configuración de permisos pendiente.",
      };
    }
    if (
      ["administrator", "committee"].includes(parsed.data.role) &&
      parsed.data.aal !== "aal2"
    )
      destination = "/sistema/mfa";
  } catch {
    return {
      error: "No se pudo iniciar sesión. Revisa la configuración del servicio.",
    };
  }
  redirect(destination);
}
export async function logoutAction() {
  await mutationOrigin();
  const client = await supabaseServer();
  await client.auth.signOut();
  redirect("/sistema/login");
}
export async function prepareMfaAction(): Promise<AuthState> {
  try {
    await mutationOrigin();
    const { client, session } = await verifiedSession();
    if (!["administrator", "committee"].includes(session.role))
      return { error: "Operación reservada al personal." };
    const factors = await client.auth.mfa.listFactors();
    if (factors.error)
      return { error: "No se pudo preparar el segundo factor." };
    const existing = factors.data.totp.find((f) => f.status === "verified");
    let factor = existing?.id;
    let qr: string | undefined;
    if (!factor) {
      // Do not accumulate abandoned enrollments on repeated page visits.
      for (const item of factors.data.all.filter(
        (f) => f.status === "unverified",
      ))
        await client.auth.mfa.unenroll({ factorId: item.id });
      const enrolled = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Comité electoral",
      });
      if (enrolled.error)
        return { error: "No se pudo inscribir el segundo factor." };
      factor = enrolled.data.id;
      qr = enrolled.data.totp.qr_code;
    }
    const challenge = await client.auth.mfa.challenge({ factorId: factor });
    if (challenge.error) return { error: "No se pudo crear el desafío MFA." };
    return {
      factor,
      challenge: challenge.data.id,
      qr,
      message: existing
        ? "Introduce el código de tu autenticador."
        : "Escanea el QR con tu autenticador y confirma el código. No compartas ni captures este QR.",
    };
  } catch {
    return { error: "Sesión o configuración MFA no disponible." };
  }
}
export async function verifyMfaAction(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  try {
    await mutationOrigin();
    const { client } = await verifiedSession();
    const code = String(form.get("code") ?? "");
    if (!/^\d{6}$/.test(code))
      return { error: "Introduce el código de seis dígitos." };
    const response = await client.auth.mfa.verify({
      factorId: String(form.get("factor") ?? ""),
      challengeId: String(form.get("challenge") ?? ""),
      code,
    });
    if (response.error)
      return { error: "Código inválido o vencido. Prepara un nuevo desafío." };
  } catch {
    return { error: "No se pudo verificar el segundo factor." };
  }
  redirect("/sistema");
}
