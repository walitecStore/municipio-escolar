import { z } from "zod";
export const uuid = z.string().uuid();
export const electionSchema = z.object({
  id: uuid,
  school: z.string(),
  year: z.number().int(),
  state: z.enum(["draft", "open", "closed"]),
  purpose: z.enum(["test", "official"]),
  security_approved: z.boolean(),
});
export type ConnectedElection = z.infer<typeof electionSchema>;
export const sessionSchema = z.object({
  role: z.enum(["administrator", "committee", "elector", "unassigned"]),
  aal: z.enum(["aal1", "aal2"]),
});
export type ElectoralSession = z.infer<typeof sessionSchema>;
export function isStaff(session: ElectoralSession) {
  return (
    ["administrator", "committee"].includes(session.role) &&
    session.aal === "aal2"
  );
}
export type IntegrationConfig = {
  url: string;
  key: string;
  origin: string;
  voting: boolean;
  official: boolean;
};
export function parseIntegrationConfig(
  env: Record<string, string | undefined>,
): IntegrationConfig | null {
  if (env.SUPABASE_INTEGRATION_ENABLED !== "true") return null;
  try {
    const url = new URL(env.SUPABASE_URL ?? "");
    const origin = new URL(env.APP_ORIGIN ?? "");
    const local = (value: URL) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname);
    const localTest =
      env.ELECTORAL_DEPLOYMENT_STAGE === "local-test" &&
      local(url) &&
      local(origin);
    if (
      (url.protocol !== "https:" && !localTest) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    if (
      (origin.protocol !== "https:" && !local(origin)) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      return null;
    const key = env.SUPABASE_PUBLISHABLE_KEY ?? "";
    // Only publishable keys; legacy JWT and service-role/secret keys are rejected.
    if (!key.startsWith("sb_publishable_")) return null;
    return {
      url: url.origin,
      key,
      origin: origin.origin,
      voting: env.ELECTORAL_RPC_VOTING_ENABLED === "true",
      official: env.ELECTORAL_OFFICIAL_VOTING_ENABLED === "true",
    };
  } catch {
    return null;
  }
}
export function votingAllowed(
  config: IntegrationConfig,
  election: ConnectedElection,
) {
  return (
    config.voting &&
    election.state === "open" &&
    (election.purpose === "test" ||
      (config.official && election.security_approved))
  );
}
export function openingAllowed(
  config: IntegrationConfig,
  election: ConnectedElection,
) {
  return (
    election.state === "draft" &&
    (election.purpose === "test" ||
      (config.official && election.security_approved))
  );
}
export function isSameOrigin(origin: string | null, expected: string) {
  return origin === expected;
}
