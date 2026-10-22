import "server-only";
import { createClient } from "@supabase/supabase-js";
import { integrationConfig } from "./env";
/** Isolated Auth provisioning only. Electoral RPC/Storage always use the user's session. */
export function invitationAdmin() {
  const config = integrationConfig();
  const key = process.env.SUPABASE_AUTH_ADMIN_KEY ?? "";
  if (!config || !key.startsWith("sb_secret_"))
    throw new Error("Invitaciones pendientes de configuración.");
  return createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).auth.admin;
}
export function invitationsConfigured() {
  return (
    !!integrationConfig() &&
    (process.env.SUPABASE_AUTH_ADMIN_KEY ?? "").startsWith("sb_secret_")
  );
}
