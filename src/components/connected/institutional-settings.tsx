"use client";
import { useActionState } from "react";
import { institutionalSettingsAction } from "@/app/sistema/[election]/configuracion/actions";
import type { ConnectedElection } from "@/lib/connected/policy";
export function InstitutionalSettings({
  election,
}: {
  election: ConnectedElection;
}) {
  const [state, action, busy] = useActionState(
    institutionalSettingsAction.bind(null, election.id),
    {} as { message?: string; error?: string },
  );
  return (
    <form action={action}>
      <fieldset disabled={busy || election.state !== "draft"}>
        <label>
          Nombre de la institución
          <input
            name="school"
            defaultValue={election.school}
            required
            maxLength={160}
          />
        </label>
        <label>
          Total definitivo de electores
          <input
            type="number"
            name="expected"
            defaultValue={election.expected_students}
            min={1}
            max={10000}
            required
          />
        </label>
        <label>
          <input type="checkbox" name="confirm" value="yes" required />
          Confirmo la configuración institucional. Esto no aprueba ni abre la
          elección.
        </label>
        <button className="button primary">Guardar configuración</button>
      </fieldset>
      {state.message && <p role="status">{state.message}</p>}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
