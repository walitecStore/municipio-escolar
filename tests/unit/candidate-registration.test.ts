import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateConflict,
  candidateRegistrationSchema,
  suggestCandidateSlot,
} from "../../src/lib/connected/candidate-registration";
import type { ConnectedList } from "../../src/lib/connected/data";
const list: ConnectedList = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Lista ficticia",
  number: 1,
  proposals: ["Propuesta"],
  symbol_path: null,
  candidates: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      name: "Alcalde ficticio",
      role: "alcalde",
      position: 0,
      title: "Alcaldía",
      grade: 1,
      section: "A",
      photo_path: null,
    },
  ],
};
test("registro: no ofrece otro alcalde y encuentra órdenes libres sin interferir con una edición", () => {
  assert.deepEqual(suggestCandidateSlot({ ...list, candidates: [] }), {
    role: "alcalde",
    position: 0,
  });
  assert.deepEqual(suggestCandidateSlot(list), {
    role: "regidor",
    position: 1,
  });
  const occupied = {
    ...list,
    candidates: [
      ...list.candidates,
      {
        ...list.candidates[0],
        id: "60000000-0000-4000-8000-000000000002",
        role: "regidor" as const,
        position: 1,
      },
    ],
  };
  assert.equal(suggestCandidateSlot(occupied).position, 2);
  assert.match(
    candidateConflict(list, { id: "", role: "alcalde", position: 0 })!,
    /ya tiene un alcalde/,
  );
  assert.equal(
    candidateConflict(list, {
      id: list.candidates[0].id,
      role: "alcalde",
      position: 0,
    }),
    null,
  );
  assert.match(
    candidateConflict(occupied, { id: "", role: "regidor", position: 1 })!,
    /orden 1 ya está ocupado/,
  );
});
test("registro: valida rol y orden con mensajes de acción, mantiene la validación de datos", () => {
  const input = {
    id: "",
    list: list.id,
    name: "Candidato ficticio",
    role: "regidor",
    position: "0",
    title: "Regiduría",
    grade: "1",
    section: "A",
  };
  const invalid = candidateRegistrationSchema.safeParse(input);
  assert.equal(invalid.success, false);
  if (!invalid.success)
    assert.match(invalid.error.issues[0].message, /1 al 20/);
  assert.equal(
    candidateRegistrationSchema.safeParse({ ...input, position: "1" }).success,
    true,
  );
  assert.equal(
    candidateRegistrationSchema.safeParse({
      ...input,
      position: "1",
      name: " ",
    }).success,
    false,
  );
  assert.equal(
    candidateRegistrationSchema.safeParse({
      ...input,
      position: "1",
      section: "Z",
    }).success,
    false,
  );
});
