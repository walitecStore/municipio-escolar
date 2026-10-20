"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { mutationOrigin, verifiedSession } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
import { passwordError } from "@/lib/connected/password-policy";
import {
  recoveryClient,
  verifiedRecovery,
  clearRecoveryCookies,
} from "@/lib/connected/recovery";
export type PasswordState = {
  error?: string;
  message?: string;
  ready?: boolean;
  mfa?: boolean;
  success?: boolean;
};
const expired =
  "El enlace no es válido, ya fue utilizado o venció. Solicita otro enlace.";
const success = "Tu contraseña se actualizó correctamente";
export async function requestRecoveryAction(
  _: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  try {
    const config = await mutationOrigin();
    const email = String(form.get("email") ?? "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254) {
      const client = await recoveryClient();
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.origin}/sistema/restablecer`,
      });
    }
  } catch {
    /* Generic response avoids disclosing accounts and provider errors. */
  }
  return {
    message:
      "Si la cuenta existe y puede recuperar su acceso, recibirá un enlace. Revisa tu correo o inténtalo más tarde.",
  };
}
export async function verifyRecoveryAction(
  _: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  try {
    await mutationOrigin();
    await clearRecoveryCookies();
    const client = await recoveryClient();
    const hash = String(form.get("token_hash") ?? "");
    const access = String(form.get("access_token") ?? "");
    const refresh = String(form.get("refresh_token") ?? "");
    let failed = true;
    if (/^[A-Za-z0-9_-]{20,2048}$/.test(hash)) {
      const response = await client.auth.verifyOtp({
        token_hash: hash,
        type: "recovery",
      });
      failed = !!response.error;
    } else if (
      access.length > 0 &&
      access.length < 16384 &&
      refresh.length > 0 &&
      refresh.length < 2048
    ) {
      const response = await client.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
      failed = !!response.error;
    }
    if (failed) throw new Error("Invalid recovery");
    const verified = await verifiedRecovery();
    return { ready: true, mfa: !!verified.factor };
  } catch {
    await clearRecoveryCookies();
    return { error: expired };
  }
}
export async function exchangeRecoveryCodeAction(
  _: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  try {
    await mutationOrigin();
    const code = String(form.get("code") ?? "");
    if (!code || code.length > 2048) throw new Error("Invalid code");
    const client = await recoveryClient();
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error) throw new Error("Invalid code");
    const verified = await verifiedRecovery();
    return { ready: true, mfa: !!verified.factor };
  } catch {
    await clearRecoveryCookies();
    return { error: expired };
  }
}
export async function recoveryStatusAction(): Promise<PasswordState> {
  try {
    await mutationOrigin();
    const verified = await verifiedRecovery();
    return { ready: true, mfa: !!verified.factor };
  } catch {
    return { error: expired };
  }
}
export async function resetPasswordAction(
  _: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  try {
    await mutationOrigin();
    const password = String(form.get("password") ?? "");
    const error = passwordError(
      password,
      String(form.get("confirmation") ?? ""),
    );
    if (error) return { error };
    const { client, factor } = await verifiedRecovery();
    if (factor) {
      const code = String(form.get("otp") ?? "");
      if (!/^\d{6}$/.test(code))
        return { error: "Introduce el código actual de tu autenticador." };
      const verified = await client.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (verified.error)
        return { error: "Código MFA inválido o vencido. Vuelve a intentarlo." };
    }
    const updated = await client.auth.updateUser({ password });
    if (updated.error)
      return {
        error:
          "No se pudo guardar. Usa una contraseña distinta y revisa la política de Supabase o solicita un enlace nuevo.",
      };
    const signedOut = await client.auth.signOut({ scope: "global" });
    await clearRecoveryCookies();
    return {
      success: true,
      message:
        success +
        (signedOut.error
          ? ". La revocación de otras sesiones no pudo confirmarse; contacta al responsable."
          : ""),
    };
  } catch {
    return { error: expired };
  }
}
export async function changePasswordAction(
  _: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  let temporary: ReturnType<typeof createClient> | undefined;
  try {
    const config = await mutationOrigin();
    const access = await verifiedSession();
    if (!isStaff(access.session))
      return { error: "Se requiere sesión de personal y MFA." };
    const password = String(form.get("password") ?? "");
    const error = passwordError(
      password,
      String(form.get("confirmation") ?? ""),
    );
    if (error) return { error };
    const current = String(form.get("current") ?? "");
    const code = String(form.get("otp") ?? "");
    if (!current || current.length > 1024 || !/^\d{6}$/.test(code))
      return {
        error: "Confirma tu contraseña actual y el código MFA vigente.",
      };
    const user = await access.client.auth.getUser();
    if (!user.data.user?.email) throw new Error("Identity unavailable");
    temporary = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const login = await temporary.auth.signInWithPassword({
      email: user.data.user.email,
      password: current,
    });
    if (login.error || login.data.user?.id !== access.userId)
      return { error: "No se pudo verificar tu identidad reciente." };
    const factors = await temporary.auth.mfa.listFactors();
    const factor = factors.data?.totp.find(
      (item) => item.status === "verified",
    );
    if (factors.error || !factor)
      return { error: "Se requiere un autenticador verificado." };
    const verified = await temporary.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });
    if (verified.error) return { error: "Código MFA inválido o vencido." };
    const updated = await temporary.auth.updateUser({ password });
    if (updated.error)
      return {
        error:
          "No se pudo guardar. Usa una contraseña distinta que cumpla también la política de Supabase.",
      };
    const signedOut = await temporary.auth.signOut({ scope: "global" });
    await access.client.auth.signOut({ scope: "local" });
    return redirect(
      signedOut.error
        ? "/sistema/login?password=updated&sessions=pending"
        : "/sistema/login?password=updated",
    );
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        "No se pudo actualizar. Vuelve a iniciar sesión y verifica tu identidad.",
    };
  } finally {
    if (temporary)
      await temporary.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
