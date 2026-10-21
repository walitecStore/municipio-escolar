"use client";
import { useActionState } from "react";
import {
  controlAction,
  type ControlState,
} from "@/app/sistema/[election]/presencial/actions";
export function StationControlForm({
  id,
  operation,
  children,
}: {
  id: string;
  operation: string;
  children: React.ReactNode;
}) {
  const [state, action, busy] = useActionState(
    controlAction.bind(null, id),
    {} as ControlState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="operation" value={operation} />
      {children}
      <button disabled={busy} className="button primary">
        {operation === "approve"
          ? "Autorizar turno"
          : operation === "cancel"
            ? "Cancelar turno"
            : operation === "revoke"
              ? "Revocar equipo"
              : operation === "configure"
                ? "Usar DNI presencial"
                : "Crear habilitación de equipo"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
      {state.token && (
        <>
          <label>
            Habilitación privada (se muestra una vez)
            <textarea readOnly value={state.token} autoComplete="off" />
          </label>
          <p>
            No es una credencial del estudiante. Se introduce una sola vez por
            computadora.
          </p>
        </>
      )}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
