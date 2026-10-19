"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import {
  loginAction,
  prepareMfaAction,
  verifyMfaAction,
  type AuthState,
} from "@/app/sistema/auth-actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {} as AuthState);
  return (
    <form action={action}>
      <label htmlFor="staff-email">Correo de la cuenta autorizada</label>
      <input
        id="staff-email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="username"
      />
      <label htmlFor="staff-password">Contraseña</label>
      <input
        id="staff-password"
        name="password"
        type="password"
        required
        maxLength={1024}
        autoComplete="current-password"
      />
      {state.error && <p role="alert">{state.error}</p>}
      <button className="button primary" disabled={pending}>
        {pending ? "Verificando…" : "Iniciar sesión segura"}
      </button>
    </form>
  );
}
export function MfaForm() {
  const [prepared, setPrepared] = useState<AuthState>({});
  const [busy, setBusy] = useState(false);
  const [state, action, pending] = useActionState(
    verifyMfaAction,
    {} as AuthState,
  );
  return (
    <>
      <p>
        Administradores y comité requieren autenticación de dos factores. La
        base de datos también comprueba AAL2.
      </p>
      <button
        className="button primary"
        disabled={busy || pending}
        onClick={async () => {
          setBusy(true);
          setPrepared(await prepareMfaAction());
          setBusy(false);
        }}
      >
        Preparar verificación MFA
      </button>
      {prepared.message && <p>{prepared.message}</p>}
      {prepared.error && <p role="alert">{prepared.error}</p>}
      {prepared.qr && (
        <Image
          unoptimized
          width={220}
          height={220}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            prepared.qr.startsWith("data:image/svg+xml")
              ? prepared.qr.slice(prepared.qr.indexOf(",") + 1)
              : prepared.qr,
          )}`}
          alt="QR privado para configurar tu autenticador"
        />
      )}
      {prepared.factor && prepared.challenge && (
        <form action={action}>
          <input type="hidden" name="factor" value={prepared.factor} />
          <input type="hidden" name="challenge" value={prepared.challenge} />
          <label htmlFor="mfa-code">Código del autenticador</label>
          <input
            id="mfa-code"
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          {state.error && <p role="alert">{state.error}</p>}
          <button className="button primary" disabled={pending}>
            Verificar segundo factor
          </button>
        </form>
      )}
    </>
  );
}
