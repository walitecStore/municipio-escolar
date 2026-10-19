import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { integrationConfig } from "./env";
export async function supabaseServer() {
  const config = integrationConfig();
  if (!config) throw new Error("Integración no configurada.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: config.origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items)
            jar.set(name, value, options);
        } catch {
          /* Server Components refresh through proxy; no session value is logged. */
        }
      },
    },
  });
}
