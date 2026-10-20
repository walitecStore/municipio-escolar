import { test } from "node:test";
import assert from "node:assert/strict";
import {
  passwordError,
  recentRecoveryProof,
} from "../../src/lib/connected/password-policy";
test("contraseñas: coincidencia, longitud UTF8 y requisitos antes de Auth", () => {
  for (const password of [
    "corta",
    "abcdefghijklmn",
    "ABCDEFGHIJKLMN",
    "Abcdefghijkl",
    "Abcdefghijk1",
    "á".repeat(37) + "Ab1!",
  ])
    assert.ok(passwordError(password, password));
  assert.ok(passwordError("Frase-ficticia2026!", "Frase-distinta2026!"));
  assert.equal(
    passwordError("Frase-ficticia2026!", "Frase-ficticia2026!"),
    null,
  );
});
test("recuperación: exige OTP reciente del usuario del JWT ya verificado por Auth", () => {
  const token = (claims: object) =>
    `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  const claims = {
    sub: "ficticio",
    exp: 2000,
    amr: [{ method: "otp", timestamp: 900 }],
  };
  assert.equal(recentRecoveryProof(token(claims), "ficticio", 1000), true);
  assert.equal(recentRecoveryProof(token(claims), "otro", 1000), false);
  assert.equal(recentRecoveryProof(token(claims), "ficticio", 1500), false);
  assert.equal(
    recentRecoveryProof(token({ ...claims, exp: 999 }), "ficticio", 1000),
    false,
  );
  assert.equal(
    recentRecoveryProof(
      token({ ...claims, amr: [{ method: "password", timestamp: 900 }] }),
      "ficticio",
      1000,
    ),
    false,
  );
  assert.equal(
    recentRecoveryProof(
      token({ ...claims, amr: [{ method: "otp", timestamp: 1100 }] }),
      "ficticio",
      1000,
    ),
    false,
  );
  assert.equal(
    recentRecoveryProof(
      token({ ...claims, amr: [{ method: "recovery", timestamp: 900 }] }),
      "ficticio",
      1000,
    ),
    true,
  );
  assert.equal(recentRecoveryProof("malformed", "ficticio", 1000), false);
});
