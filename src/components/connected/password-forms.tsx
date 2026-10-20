"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  changePasswordAction,
  resetPasswordAction,
  requestRecoveryAction,
  verifyRecoveryAction,
  exchangeRecoveryCodeAction,
  recoveryStatusAction,
  type PasswordState,
} from "@/app/sistema/password-actions";
export function RequestRecoveryForm() {
  const [state, action, pending] = useActionState(
    requestRecoveryAction,
    {} as PasswordState,
  );
  return (
    <form action={action}>
      <label htmlFor="recovery-email">Correo de la cuenta autorizada</label>
      <input
        id="recovery-email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
      />
      {state.message && <p role="status">{state.message}</p>}
      <button className="button primary" disabled={pending}>
        Solicitar otro enlace
      </button>
    </form>
  );
}
export function PasswordForm({
  recovery = false,
  mfa = true,
}: {
  recovery?: boolean;
  mfa?: boolean;
}) {
  const [state, action, pending] = useActionState(
    recovery ? resetPasswordAction : changePasswordAction,
    {} as PasswordState,
  );
  if (state.success)
    return (
      <div role="status">
        <p>{state.message}</p>
        <Link className="button primary" href="/sistema/login">
          Iniciar sesión nuevamente
        </Link>
      </div>
    );
  return (
    <>
      <form action={action}>
        {!recovery && (
          <>
            <label htmlFor="current-password">Contraseña actual</label>
            <input
              id="current-password"
              name="current"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
          </>
        )}
        <p>
          Al menos 12 caracteres y hasta 72 bytes. Incluye mayúscula, minúscula,
          número y símbolo. Supabase puede aplicar requisitos adicionales.
        </p>
        <label htmlFor="new-password">Nueva contraseña</label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
        />
        <label htmlFor="confirm-password">Confirmar nueva contraseña</label>
        <input
          id="confirm-password"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
        />
        {mfa && (
          <>
            <label htmlFor="password-otp">Código actual del autenticador</label>
            <input
              id="password-otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </>
        )}
        {state.error && <p role="alert">{state.error}</p>}
        <button className="button primary" disabled={pending}>
          {pending ? "Verificando…" : "Guardar contraseña"}
        </button>
      </form>
      {recovery && state.error && <RequestRecoveryForm />}
    </>
  );
}
export function RecoveryForm() {
  const captured = useRef(false);
  const proof = useRef<FormData | null>(null);
  const codeMode = useRef(false);
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<PasswordState>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const saved = (
      window as Window & { __electoralRecovery?: Record<string, string> }
    ).__electoralRecovery;
    delete (window as Window & { __electoralRecovery?: Record<string, string> })
      .__electoralRecovery;
    const data = new FormData();
    if (saved)
      for (const [name, value] of Object.entries(saved)) data.set(name, value);
    codeMode.current = data.has("code");
    if ([...data.keys()].length) {
      proof.current = data;
      queueMicrotask(() => setAvailable(true));
    } else void recoveryStatusAction().then(setState);
  }, []);
  if (state.ready) return <PasswordForm recovery mfa={state.mfa} />;
  return (
    <>
      <p>
        Verifica el enlace antes de establecer una nueva contraseña. No
        compartas el enlace ni el QR o código de tu autenticador.
      </p>
      {available && (
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            if (!proof.current) return;
            setBusy(true);
            const data = proof.current;
            proof.current = null;
            setAvailable(false);
            try {
              setState(
                await (
                  codeMode.current
                    ? exchangeRecoveryCodeAction
                    : verifyRecoveryAction
                )({}, data),
              );
            } catch {
              setState({
                error: "No se pudo verificar el enlace. Solicita otro.",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Verificar enlace de recuperación
        </button>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {!available && !busy && <RequestRecoveryForm />}
      <Link className="text-link" href="/sistema/login">
        Volver al inicio de sesión
      </Link>
    </>
  );
}
