import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RecoveryRequestLimiter,
  recoveryFailure,
} from "../../src/lib/connected/recovery-request-policy";
test("envío: clasifica fallos sin interpretar mensajes privados ni revelar cuentas", () => {
  assert.equal(recoveryFailure({ status: 429 }), "rate_limit");
  assert.equal(
    recoveryFailure({ code: "over_email_send_rate_limit" }),
    "rate_limit",
  );
  assert.equal(
    recoveryFailure({ code: "email_address_not_authorized" }),
    "configuration",
  );
  assert.equal(
    recoveryFailure({ code: "user_not_found", status: 400 }),
    "account_neutral",
  );
  assert.equal(recoveryFailure({ code: "email_not_confirmed" }), "provider");
  assert.equal(recoveryFailure({ status: 503 }), "mail_service");
  assert.equal(
    recoveryFailure({ status: 500, name: "AuthRetryableFetchError" }),
    "mail_service",
  );
  assert.equal(
    recoveryFailure({ status: 0, name: "AuthRetryableFetchError" }),
    "connection",
  );
  assert.equal(recoveryFailure({ code: "fetch_error" }), "connection");
  assert.equal(
    recoveryFailure({ status: 400, code: "unrecognized-sensitive-text" }),
    "provider",
  );
});
test("límites: reserva atómica por correo e IP, caducidad y protección global por instancia", async () => {
  const limiter = new RecoveryRequestLimiter();
  const outcomes = await Promise.all(
    Array.from({ length: 12 }, () =>
      Promise.resolve().then(() =>
        limiter.reserve("ficticio@example.test", "192.0.2.1", 1000),
      ),
    ),
  );
  assert.equal(outcomes.filter((n) => n === 0).length, 1);
  assert.ok(limiter.reserve("FICTICIO@example.test", "192.0.2.2", 2000) > 0);
  assert.equal(limiter.reserve("ficticio@example.test", "192.0.2.1", 61000), 0);
  for (let i = 0; i < 3; i++)
    assert.equal(
      limiter.reserve(`otro${i}@example.test`, "192.0.2.1", 62000),
      0,
    );
  assert.ok(limiter.reserve("otro-final@example.test", "192.0.2.1", 62000) > 0);
  assert.equal(
    limiter.reserve("otro-final@example.test", "192.0.2.1", 901000),
    0,
  );
  const global = new RecoveryRequestLimiter();
  for (let i = 0; i < 30; i++)
    assert.equal(
      global.reserve(`global${i}@example.test`, `192.0.2.${i}`, 0),
      0,
    );
  assert.ok(global.reserve("final@example.test", "192.0.2.100", 0) > 0);
  assert.equal(global.reserve("final@example.test", "192.0.2.100", 60000), 0);
});
