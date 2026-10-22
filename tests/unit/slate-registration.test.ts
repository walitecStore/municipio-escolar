import { test } from "node:test";
import assert from "node:assert/strict";
import { slateRegistrationSchema } from "../../src/lib/connected/slate-registration";
const input = {
  request: "10000000-0000-4000-8000-000000000001",
  party: " Partido escolar ",
  proposals: ["Propuesta real de la inscripción"],
  mayor: { name: " Alcalde ficticio ", grade: "4", section: "B" },
  regidors: [
    { name: "Regidor ficticio", grade: "3", section: "A", title: "Educación" },
  ],
};
test("plana guiada: requiere alcalde, partido y regidores válidos sin pedir numeración", () => {
  const parsed = slateRegistrationSchema.parse(input);
  assert.equal(parsed.party, "Partido escolar");
  assert.equal(parsed.mayor.grade, 4);
  assert.equal(parsed.mayor.name, "Alcalde ficticio");
  assert.equal(
    slateRegistrationSchema.safeParse({ ...input, regidors: [] }).success,
    false,
  );
  assert.equal(
    slateRegistrationSchema.safeParse({
      ...input,
      regidors: Array.from({ length: 21 }, () => input.regidors[0]),
    }).success,
    false,
  );
  assert.equal(
    slateRegistrationSchema.safeParse({
      ...input,
      regidors: [{ ...input.regidors[0], title: " " }],
    }).success,
    false,
  );
  assert.equal(
    slateRegistrationSchema.safeParse({
      ...input,
      mayor: { ...input.mayor, grade: "" },
    }).success,
    false,
  );
  assert.equal(
    slateRegistrationSchema.safeParse({ ...input, proposals: [] }).success,
    false,
  );
});
