"use client";
import { useActionState } from "react";
import {
  institutionAction,
  type InstitutionState,
} from "@/app/sistema/instituciones/actions";
export function InstitutionForm({
  operation,
  children,
  label,
}: {
  operation: string;
  children: React.ReactNode;
  label: string;
}) {
  const [state, action, busy] = useActionState(
    institutionAction,
    {} as InstitutionState,
  );
  return (
    <form action={action}>
      <fieldset disabled={busy}>
        <input type="hidden" name="operation" value={operation} />
        {children}
        <button className="button primary">{label}</button>
      </fieldset>
      {state.message && <p role="status">{state.message}</p>}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
