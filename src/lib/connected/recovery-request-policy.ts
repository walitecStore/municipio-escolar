import { createHmac, randomBytes } from "node:crypto";
export type RecoveryFailure =
  | "connection"
  | "rate_limit"
  | "mail_service"
  | "configuration"
  | "provider"
  | "account_neutral";
export function recoveryFailure(error: {
  status?: number;
  name?: string;
  code?: string;
}): RecoveryFailure {
  if (
    error.status === 429 ||
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      error.code ?? "",
    )
  )
    return "rate_limit";
  if (error.code === "user_not_found") return "account_neutral";
  if (
    [
      "email_address_not_authorized",
      "email_provider_disabled",
      "smtp_admin_email_required",
    ].includes(error.code ?? "")
  )
    return "configuration";
  if ((error.status ?? 0) >= 500) return "mail_service";
  if (
    (error.status ?? 0) === 0 &&
    (error.name === "AuthRetryableFetchError" || error.code === "fetch_error")
  )
    return "connection";
  return "provider";
}
/** Bounded per-instance defense; Supabase and the edge must enforce shared limits. */
export class RecoveryRequestLimiter {
  private readonly salt = randomBytes(32);
  private readonly entries = new Map<
    string,
    { count: number; until: number }
  >();
  reserve(email: string, ip: string, now = Date.now()): number {
    for (const [key, entry] of this.entries)
      if (entry.until <= now) this.entries.delete(key);
    const hash = (value: string) =>
      createHmac("sha256", this.salt).update(value).digest("hex");
    const rules: [string, number, number][] = [
      ["email:" + hash(email.toLowerCase()), 1, 60_000],
      ["ip:" + hash(ip), 5, 900_000],
      ["instance", 30, 60_000],
    ];
    let wait = 0;
    for (const [key, limit] of rules) {
      const entry = this.entries.get(key);
      if (entry && entry.count >= limit)
        wait = Math.max(wait, Math.ceil((entry.until - now) / 1000));
    }
    if (wait) return wait;
    if (this.entries.size + rules.length > 5000) return 60;
    // Reserve synchronously before any provider request, including failed sends.
    for (const [key, , window] of rules) {
      const entry = this.entries.get(key);
      this.entries.set(key, {
        count: (entry?.count ?? 0) + 1,
        until: entry?.until ?? now + window,
      });
    }
    return 0;
  }
}
