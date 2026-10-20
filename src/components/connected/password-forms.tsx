"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Heading } from "@/components/ui";
import {
  changePasswordAction,
  resetPasswordAction,
  requestRecoveryAction,
  verifyRecoveryAction,
  exchangeRecoveryCodeAction,
  recoveryStatusAction,
  type PasswordState,
} from "@/app/sistema/password-actions";
const expiredMessage =
  "Este enlace ha vencido o ya fue utilizado. Solicita uno nuevo";
export function RequestRecoveryForm() {
  const [state, action, pending] = useActionState(
    requestRecoveryAction,
    {} as PasswordState,
  );
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const deadline = Date.now() + (state.retryAfter ?? 0) * 1000;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    queueMicrotask(update);
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [state]);
  return (
    <form action={action} className="recovery-request">
      <label htmlFor="recovery-email">Correo electrónico</label>
      <input
        id="recovery-email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        placeholder="correo@ejemplo.com"
      />
      {state.error && (
        <p role="alert" className="recovery-feedback error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="recovery-feedback">
          {state.message}
        </p>
      )}
      <button className="button primary" disabled={pending || remaining > 0}>
        {pending ? "PROCESANDO…" : "RESTABLECER CONTRASEÑA"}
      </button>
      {remaining > 0 && (
        <p className="recovery-help">
          Podrás volver a solicitarlo en {remaining} segundos.
        </p>
      )}
    </form>
  );
}
function NewPasswordInput({
  confirmation = false,
}: {
  confirmation?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const label = confirmation
    ? "Confirmar nueva contraseña"
    : "Nueva contraseña";
  const id = confirmation ? "confirm-password" : "new-password";
  return (
    <div className="password-control">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-row">
        <input
          id={id}
          name={confirmation ? "confirmation" : "password"}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
        />
        <button
          type="button"
          className="password-visibility"
          aria-controls={id}
          aria-pressed={visible}
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}
function ExpiredLink({ restart }: { restart: () => void }) {
  return (
    <div className="recovery-expired">
      <p role="alert" className="recovery-feedback error">
        {expiredMessage}
      </p>
      <button className="button primary" onClick={restart}>
        SOLICITAR NUEVO ENLACE
      </button>
    </div>
  );
}
export function PasswordForm({
  recovery = false,
  mfa = true,
  restart,
}: {
  recovery?: boolean;
  mfa?: boolean;
  restart?: () => void;
}) {
  const [state, action, pending] = useActionState(
    recovery ? resetPasswordAction : changePasswordAction,
    {} as PasswordState,
  );
  if (state.success)
    return (
      <div className="recovery-success">
        <p role="status" className="recovery-feedback">
          {state.message}
        </p>
        <Link className="button primary" href="/sistema/login">
          IR A INICIAR SESIÓN
        </Link>
      </div>
    );
  if (recovery && state.expired && restart)
    return <ExpiredLink restart={restart} />;
  return (
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
      <p className="recovery-help">
        Al menos 12 caracteres y hasta 72 bytes. Incluye mayúscula, minúscula,
        número y símbolo. Supabase puede aplicar requisitos adicionales.
      </p>
      <NewPasswordInput />
      <NewPasswordInput confirmation />
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
      {state.error && (
        <p role="alert" className="recovery-feedback error">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending
          ? "VERIFICANDO…"
          : recovery
            ? "GUARDAR NUEVA CONTRASEÑA"
            : "Guardar contraseña"}
      </button>
    </form>
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
    const transport = window as Window & {
      __electoralRecovery?: Record<string, string>;
      __electoralRecoveryExpired?: boolean;
    };
    const saved = transport.__electoralRecovery;
    const expired = transport.__electoralRecoveryExpired;
    delete transport.__electoralRecovery;
    delete transport.__electoralRecoveryExpired;
    const data = new FormData();
    if (saved)
      for (const [name, value] of Object.entries(saved)) data.set(name, value);
    codeMode.current = data.has("code");
    if ([...data.keys()].length) {
      proof.current = data;
      queueMicrotask(() => setAvailable(true));
    } else if (expired)
      queueMicrotask(() => setState({ error: expiredMessage, expired: true }));
    else
      void recoveryStatusAction()
        .then(setState)
        .catch(() =>
          setState({
            error: "No se pudo consultar la recuperación. Inténtalo más tarde.",
          }),
        );
  }, []);
  const restart = () => {
    proof.current = null;
    setState({});
    setAvailable(false);
  };
  return (
    <>
      <div className="recovery-emblem" aria-hidden="true">
        ✦
      </div>
      <Heading
        eyebrow="MUNICIPIO ESCOLAR · ACCESO SEGURO"
        title={
          state.ready ? "CREAR NUEVA CONTRASEÑA" : "RESTABLECER CONTRASEÑA"
        }
        description={
          state.ready
            ? "Establece una contraseña segura. Mantendremos la verificación MFA para acceder al panel."
            : available
              ? "Confirma el enlace de tu correo para continuar de forma segura."
              : "Ingresa tu correo electrónico registrado para recibir un enlace de recuperación."
        }
      />
      {state.ready ? (
        <PasswordForm recovery mfa={state.mfa} restart={restart} />
      ) : state.expired ? (
        <ExpiredLink restart={restart} />
      ) : (
        <>
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
                    error: "No se pudo verificar el enlace. Solicita uno nuevo",
                    expired: true,
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Verificar enlace de recuperación
            </button>
          )}
          {state.error && (
            <p role="alert" className="recovery-feedback error">
              {state.error}
            </p>
          )}
          {!available && !busy && <RequestRecoveryForm />}
        </>
      )}
      <div className="recovery-back">
        <Link className="text-link" href="/sistema/login">
          Volver al inicio de sesión
        </Link>
        <p className="recovery-help">
          ¿Aún puedes entrar a tu cuenta y recuerdas tu contraseña actual? No necesitas recibir un correo: entra al panel y utiliza Perfil → Cambiar contraseña.
        </p>
        <Link className="text-link" href="/sistema/perfil">
          Ir a cambiar mi contraseña desde el perfil
        </Link>
      </div>
    </>
  );
}
