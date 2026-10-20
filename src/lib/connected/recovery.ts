import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { integrationConfig } from "./env";
import { recentRecoveryProof } from "./password-policy";
import { sessionSchema } from "./policy";
const cookieName = "electoral-recovery";
export async function recoveryClient() {
  const config = integrationConfig();
  if (!config) throw new Error("Integración no disponible.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      name: cookieName,
      path: "/sistema/restablecer",
      maxAge: 600,
      httpOnly: true,
      secure: config.origin.startsWith("https:"),
      sameSite: "lax",
    },
    cookies: {
      getAll: () =>
        jar.getAll().filter(({ name }) => name.startsWith(cookieName)),
      setAll: (items) => {
        for (const { name, value, options } of items)
          jar.set(name, value, {
            ...options,
            maxAge: options.maxAge === 0 ? 0 : 600,
          });
      },
    },
  });
}
export async function clearRecoveryCookies() {
  const jar = await cookies();
  for (const { name } of jar
    .getAll()
    .filter(({ name }) => name.startsWith(cookieName)))
    jar.set(name, "", {
      path: "/sistema/restablecer",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: integrationConfig()?.origin.startsWith("https:"),
    });
}
export async function verifiedRecovery() {
  const client = await recoveryClient();
  const { data: stored } = await client.auth.getSession();
  const token = stored.session?.access_token;
  if (!token) throw new Error("Enlace no disponible.");
  // getSession alone is never trusted. Validate this exact token with Auth first.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || !recentRecoveryProof(token, data.user.id))
    throw new Error("Enlace vencido.");
  const context = await client.rpc("get_electoral_session");
  const parsed = sessionSchema.safeParse(context.data);
  if (
    context.error ||
    !parsed.success ||
    !["administrator", "committee"].includes(parsed.data.role)
  )
    throw new Error("Cuenta no autorizada.");
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw new Error("MFA no disponible.");
  return {
    client,
    factor: factors.data.totp.find((factor) => factor.status === "verified"),
  };
}
