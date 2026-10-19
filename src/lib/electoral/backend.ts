import { prepareElectoralCredential } from "../security/credentials";

/** Inject a session-bound RPC transport after verifying the user's JWT on the server.
 * Never accept a role/user ID from browser input. No transport is connected here. */
export interface AuthorizedRpc {
  call<T>(name: string, parameters: Record<string, unknown>): Promise<T>;
}
export async function issueCredential(
  rpc: AuthorizedRpc,
  election: string,
  elector: string,
) {
  const credential = prepareElectoralCredential();
  let version: string;
  try {
    version = await rpc.call<string>("register_electoral_credential", {
      p_election: election,
      p_elector: elector,
      p_token_hash: credential.tokenHash,
      p_expires_at: credential.expiresAt.toISOString(),
    });
  } catch {
    throw new Error("No se pudo emitir la credencial electoral.");
  }
  // Caller must hand this to exactly one supervised recipient, once, without logs.
  return { token: credential.token, expiresAt: credential.expiresAt, version };
}
export type VoteOutcome = "registered" | "retryable" | "rejected" | "unknown";
export async function submitVote(
  rpc: AuthorizedRpc,
  election: string,
  token: string,
  choice: string | null,
): Promise<VoteOutcome> {
  try {
    await rpc.call("cast_electoral_vote", {
      p_election: election,
      p_token: token,
      p_choice: choice,
    });
    return "registered";
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const transient = ["40001", "40P01", "08006", "08003", "57014"].includes(
      code,
    );
    // Resolve an uncertain commit without re-sending a preference or logging the error.
    try {
      const participated = await rpc.call<boolean>("electoral_vote_status", {
        p_election: election,
      });
      return participated ? "registered" : transient ? "retryable" : "rejected";
    } catch {
      return "unknown";
    }
  }
}

/** Call only after an authorized supervisor confirms delivery to the individual. */
export async function confirmCredentialDelivery(
  rpc: AuthorizedRpc,
  election: string,
  elector: string,
  version: string,
) {
  try {
    await rpc.call("confirm_electoral_delivery", {
      p_election: election,
      p_elector: elector,
      p_version: version,
    });
  } catch {
    throw new Error("No se pudo confirmar la entrega de la credencial.");
  }
}
