"use client";
import { useActionState, useState, useEffect } from "react";
import { VoterWelcome, VoterThanks } from "./voter-experience";
import { boothAction } from "@/app/sistema/mesa/actions";
import type { StationState } from "@/lib/connected/station";
export function Booth({ configured }: { configured: boolean }) {
  const [state, action, busy] = useActionState(boothAction, {
    state: "ready",
  } as StationState);
  const [connected, setConnected] = useState(configured);
  const [connectionError, setConnectionError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [round, setRound] = useState(0);
  const [choice, setChoice] = useState("");
  const [expiredState, setExpiredState] = useState<StationState | null>(null);
  const expired = expiredState === state;
  useEffect(() => {
    if (state.state !== "authorized") return;
    const timeout = setTimeout(() => {
      setExpiredState(state);
      setChoice("");
    }, 120000);
    return () => clearTimeout(timeout);
  }, [state]);
  return (
    <section className="panel">
      <h1>Mesa de votación presencial</h1>
      {!connected ? (
        <form
          action={async (f) => {
            setConnecting(true);
            setConnectionError("");
            try {
              const result = await boothAction({ state: "ready" }, f);
              if (result.error) setConnectionError(result.error);
              else setConnected(true);
            } catch {
              setConnectionError(
                "No se pudo habilitar esta computadora. Consulta al comité y vuelve a intentarlo.",
              );
            } finally {
              setConnecting(false);
            }
          }}
        >
          <input type="hidden" name="operation" value="connect" />
          <label>
            Habilitación del equipo (solo comité)
            <input
              name="station"
              type="password"
              autoComplete="off"
              required
              minLength={64}
              maxLength={64}
            />
          </label>
          {connectionError && <p role="alert">{connectionError}</p>}
          <button disabled={busy || connecting} className="button primary">
            {connecting ? "Habilitando…" : "Habilitar equipo"}
          </button>
        </form>
      ) : (
        <VoterWelcome key={round}>
          <button
            className="button secondary"
            onClick={() => {
              setConnected(false);
              setChoice("");
            }}
          >
            Cambiar habilitación del equipo (solo comité)
          </button>
          <p>
            El comité verificará tu identidad presencialmente antes de mostrar
            tu nombre y la papeleta.
          </p>
          {(state.state === "ready" ||
            state.state === "unavailable" ||
            state.state === "limited") && (
            <form action={action}>
              <input type="hidden" name="operation" value="request" />
              <label>
                DNI
                <input
                  name="dni"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  minLength={8}
                  maxLength={8}
                  autoComplete="off"
                  required
                />
              </label>
              <button disabled={busy} className="button primary">
                Solicitar mi turno
              </button>
            </form>
          )}
          {state.state === "unavailable" && (
            <p>No se pudo habilitar el turno. Consulta al comité.</p>
          )}
          {state.state === "limited" && (
            <p>Espera un minuto antes de solicitar otro turno.</p>
          )}
          {state.state === "pending" && (
            <p>Espera la verificación presencial del comité.</p>
          )}
          {state.state === "authorized" && !expired && (
            <form
              action={async (f) => {
                await action(f);
                setChoice("");
              }}
            >
              <h2>{state.name}</h2>
              <p>Si este no es tu nombre, avisa al comité y no votes.</p>
              <input type="hidden" name="operation" value="cast" />
              {state.lists?.map((l) => (
                <label key={l.id} className="blank-vote">
                  <input
                    type="radio"
                    name="choice"
                    value={l.id}
                    checked={choice === l.id}
                    onChange={() => setChoice(l.id)}
                    required
                  />
                  {l.number}. {l.name} · Alcaldía: {l.mayor}
                </label>
              ))}
              <label className="blank-vote">
                <input
                  type="radio"
                  name="choice"
                  value="blank"
                  checked={choice === "blank"}
                  onChange={() => setChoice("blank")}
                  required
                />
                Voto en blanco
              </label>
              <p>
                Tu selección:{" "}
                {choice === "blank"
                  ? "Voto en blanco"
                  : (state.lists?.find((l) => l.id === choice)?.name ??
                    "Elige una opción")}
              </p>
              <label>
                <input type="checkbox" name="confirm" value="yes" required />
                Confirmo mi selección. El voto no podrá cambiarse.
              </label>
              <button disabled={busy || !choice} className="button primary">
                Confirmar y emitir voto
              </button>
            </form>
          )}
          {expired && (
            <p>
              La autorización venció. Comprueba el estado y consulta al comité.
            </p>
          )}
          {state.state === "consumed" && (
            <>
              <VoterThanks />
              <h2>Participación registrada</h2>
              <p>
                No se muestra tu selección para proteger el secreto del voto.
              </p>
              <form action={async form => { action(form); setRound(n => n + 1); }}>
                <input type="hidden" name="operation" value="finish" />
                <button disabled={busy} className="button primary">
                  Terminar y limpiar pantalla
                </button>
              </form>
            </>
          )}
          <form
            action={async (f) => {
              setChoice("");
              await action(f);
            }}
          >
            <input type="hidden" name="operation" value="status" />
            <button disabled={busy} className="button secondary">
              Comprobar estado / autorización
            </button>
          </form>
        </VoterWelcome>
      )}
      {state.error && <p role="alert">{state.error}</p>}
    </section>
  );
}
