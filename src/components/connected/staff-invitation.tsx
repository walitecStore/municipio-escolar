"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus, Copy, Check, ShieldCheck } from "lucide-react";
import {
  inviteStaffAction,
  type InvitationState,
} from "@/app/sistema/instituciones/invite-actions";
import {
  acceptInvitationAction,
  type AcceptInvitationState,
} from "@/app/sistema/invitacion/actions";
export function StaffInvitation({
  institution,
  pending,
}: {
  institution: string;
  pending?: { id: string; name: string; email: string; role: string };
}) {
  const [state, action, busy] = useActionState(
    inviteStaffAction,
    {} as InvitationState,
  );
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="staff-invitation">
      <input type="hidden" name="institution" value={institution} />
      <fieldset disabled={busy}>
        <legend>
          {pending
            ? "Renovar invitación pendiente"
            : "Invitar personal autorizado"}
        </legend>
        {pending ? (
          <>
            <input type="hidden" name="existing" value={pending.id} />
            <input type="hidden" name="name" value={pending.name} />
            <input type="hidden" name="email" value={pending.email} />
            <input type="hidden" name="role" value={pending.role} />
          </>
        ) : (
          <>
            <label>
              Nombre y apellidos
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Correo de la persona
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              Rol del personal
              <select name="role" defaultValue="committee">
                <option value="committee">Comité electoral</option>
                <option value="administrator">
                  Administrador institucional
                </option>
              </select>
            </label>
          </>
        )}
        <p className="field-help">
          Cada persona usa su propia contraseña y verificación de seguridad. Su
          acceso queda limitado a esta institución.
        </p>
        <button className="button primary" onClick={() => setCopied(false)}>
          <UserPlus size={19} aria-hidden="true" />
          {busy
            ? "Creando invitación…"
            : pending
              ? "Generar nuevo enlace"
              : "Generar invitación personal"}
        </button>
      </fieldset>
      {state.error && (
        <p role="alert" className="notice">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="invitation-delivery" role="status">
          <strong>Invitación lista para entregar</strong>
          <p>{state.message}</p>
          <label>
            Enlace privado de un solo uso
            <textarea
              readOnly
              value={state.link}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Enlace copiado" : "Copiar invitación"}
          </button>
          <p>
            Úsalo cuanto antes: vence según la configuración de Auth. No lo
            publiques ni lo incluyas en capturas. Si no puedes copiarlo con el
            botón, selecciona el enlace y cópialo manualmente.
          </p>
        </div>
      )}
    </form>
  );
}
export function AcceptStaffInvitation() {
  const [token, setToken] = useState("");
  const [state, action, busy] = useActionState(
    acceptInvitationAction,
    {} as AcceptInvitationState,
  );
  const captured = useRef(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const proof = fragment.get("token_hash") ?? "";
    queueMicrotask(() => setToken(proof));
    if (window.location.hash)
      window.history.replaceState({}, "", window.location.pathname);
  }, []);
  if (state.done)
    return (
      <>
        <ShieldCheck size={42} aria-hidden="true" />
        <h1>Tu cuenta está lista</h1>
        <p>
          Inicia sesión con tu correo y la contraseña que acabas de crear.
          Después configura la verificación de seguridad para acceder al comité.
        </p>
        <Link className="button primary" href="/sistema/login">
          Iniciar sesión
        </Link>
      </>
    );
  return (
    <>
      <h1>Activa tu acceso al equipo</h1>
      <p>
        Crea tu contraseña personal. El enlace es de un solo uso y solo activa
        la cuenta invitada.
      </p>
      {!token ? (
        <p role="alert" className="notice">
          Abre el enlace completo que te entregó el administrador. Si ya lo
          usaste, inicia sesión o recupera tu contraseña.
        </p>
      ) : (
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <label>
            Tu nueva contraseña
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label>
            Repite tu contraseña
            <input
              type="password"
              name="confirmation"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <p>
            Usa al menos 12 caracteres con mayúscula, minúscula, número y
            símbolo.
          </p>
          {state.error && (
            <p role="alert" className="notice">
              {state.error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? "Activando cuenta…"
              : "Crear contraseña y activar mi cuenta"}
          </button>
        </form>
      )}
      <Link href="/sistema/login" className="button secondary">
        Ir al inicio de sesión
      </Link>
    </>
  );
}
