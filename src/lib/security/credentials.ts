import { randomBytes, createHash } from "node:crypto";
/** Server-only utility. Never return or log hashes or tokens in public demos. */
export function prepareElectoralCredential(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { token, tokenHash, expiresAt };
}
