export function passwordError(
  password: string,
  confirmation: string,
): string | null {
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  if (
    password.length < 12 ||
    new TextEncoder().encode(password).length > 72 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  )
    return "Usa al menos 12 caracteres, hasta 72 bytes, con mayúscula, minúscula, número y símbolo.";
  return null;
}
/** Call ONLY after Supabase getUser(accessToken) has verified this exact JWT. */
export function recentRecoveryProof(
  verifiedToken: string,
  userId: string,
  now = Date.now() / 1000,
): boolean {
  try {
    const claims = JSON.parse(
      Buffer.from(verifiedToken.split(".")[1], "base64url").toString(),
    );
    return (
      claims.sub === userId &&
      claims.exp > now &&
      Array.isArray(claims.amr) &&
      claims.amr.some(
        (item: { method?: string; timestamp?: number }) =>
          (item.method === "otp" || item.method === "recovery") &&
          typeof item.timestamp === "number" &&
          item.timestamp <= now + 30 &&
          now - item.timestamp < 600,
      )
    );
  } catch {
    return false;
  }
}
