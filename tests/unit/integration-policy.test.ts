import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseIntegrationConfig,
  votingAllowed,
  openingAllowed,
  isStaff,
  isSameOrigin,
  type ConnectedElection,
} from "../../src/lib/connected/policy";
const env = {
  SUPABASE_INTEGRATION_ENABLED: "true",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  APP_ORIGIN: "https://electoral.example.test",
};
const election: ConnectedElection = {
  id: "10000000-0000-0000-0000-000000000001",
  school: "Institución ficticia",
  year: 2026,
  state: "open",
  purpose: "test",
  security_approved: false,
  supervised_dni: false,
  expected_students: 230,
};
test("integración falla cerrada sin configuración y rechaza claves secretas o URL insegura", () => {
  assert.equal(parseIntegrationConfig({}), null);
  assert.equal(
    parseIntegrationConfig({ ...env, SUPABASE_INTEGRATION_ENABLED: "false" }),
    null,
  );
  assert.equal(
    parseIntegrationConfig({
      ...env,
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_do_not_use",
    }),
    null,
  );
  assert.equal(
    parseIntegrationConfig({
      ...env,
      SUPABASE_URL: "http://example.supabase.co",
    }),
    null,
  );
  assert.equal(
    parseIntegrationConfig({
      ...env,
      SUPABASE_URL: "https://example.supabase.co/path",
    }),
    null,
  );
  assert.ok(parseIntegrationConfig(env));
});
test("votación y apertura oficial necesitan barreras explícitas; comité exige MFA", () => {
  const config = parseIntegrationConfig(env)!;
  assert.equal(votingAllowed(config, election), false);
  const enabled = { ...config, voting: true };
  assert.equal(votingAllowed(enabled, election), true);
  const official = { ...election, purpose: "official" as const };
  assert.equal(votingAllowed(enabled, official), false);
  assert.equal(votingAllowed({ ...enabled, official: true }, official), false);
  assert.equal(
    votingAllowed(
      { ...enabled, official: true },
      { ...official, security_approved: true },
    ),
    true,
  );
  assert.equal(openingAllowed(enabled, { ...official, state: "draft" }), false);
  assert.equal(
    isStaff({ platform_operator: false, role: "committee", aal: "aal1" }),
    false,
  );
  assert.equal(
    isStaff({ platform_operator: false, role: "committee", aal: "aal2" }),
    true,
  );
  assert.equal(
    isSameOrigin("https://attacker.example.test", env.APP_ORIGIN),
    false,
  );
});
