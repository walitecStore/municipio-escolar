import "server-only";
import { headers } from "next/headers";
import {
  RecoveryRequestLimiter,
  type RecoveryFailure,
} from "./recovery-request-policy";
const limiter = new RecoveryRequestLimiter();
export async function reserveRecoveryRequest(email: string) {
  const incoming = await headers();
  // Vercel supplies this trusted header. Other deployments use a shared fallback.
  // Forwarded headers are accepted only for the loopback HTTP fixture outside Vercel.
  const source =
    process.env.VERCEL === "1"
      ? incoming.get("x-vercel-forwarded-for")
      : process.env.ELECTORAL_DEPLOYMENT_STAGE === "local-test"
        ? incoming.get("x-forwarded-for")
        : null;
  return limiter.reserve(
    email,
    source?.split(",")[0].trim().slice(0, 128) || "shared-unknown-origin",
  );
}
export function recoveryDiagnostic(
  outcome: RecoveryFailure | "accepted" | "local_limit" | "unavailable",
  status?: number,
) {
  // Deliberately no raw exception, code, email, IP, URL, cookie or request body.
  console.info(
    JSON.stringify({
      event: "password_recovery_request",
      outcome,
      ...(Number.isInteger(status) && status! >= 100 && status! <= 599
        ? { provider_status: status }
        : {}),
    }),
  );
}
