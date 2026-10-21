import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicInstitution,
  demonstrationsEnabled,
} from "../../src/lib/platform";
test("interfaz institucional excluye demostraciones por defecto y en dominios públicos", () => {
  assert.equal(demonstrationsEnabled({}), false);
  assert.equal(
    demonstrationsEnabled({
      ELECTORAL_DEMO_ENABLED: "true",
      ELECTORAL_DEPLOYMENT_STAGE: "local-test",
      APP_ORIGIN: "https://colegio.example.test",
    }),
    false,
  );
  assert.equal(
    demonstrationsEnabled({
      ELECTORAL_DEMO_ENABLED: "true",
      ELECTORAL_DEPLOYMENT_STAGE: "local-test",
      APP_ORIGIN: "http://127.0.0.1:3100",
    }),
    true,
  );
  assert.equal(
    publicInstitution({
      ELECTORAL_INSTITUTION_NAME: "Institución ficticia",
      ELECTORAL_EXPECTED_STUDENTS: "320",
    }).expectedStudents,
    320,
  );
  assert.throws(() => publicInstitution({ ELECTORAL_EXPECTED_STUDENTS: "-1" }));
});
