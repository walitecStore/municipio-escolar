/* eslint-disable @next/next/no-location-assign-relative-destination -- Hard navigation discards voter UI memory after confirmed cleanup. */
/* eslint-disable @next/next/no-img-element -- Small sanitized inline WebP thumbnails. */
"use client";
import type { BallotPresentation } from "@/lib/connected/presentation";
import { UserRound, Vote } from "lucide-react";
import { useActionState, useState, useEffect } from "react";
import { VoterThanks } from "./voter-experience";
import { boothAction } from "@/app/sistema/mesa/actions";
import type { StationState } from "@/lib/connected/station";
export function Booth({ configured }: { configured: boolean }) {
  const [state, action, busy] = useActionState(boothAction, {
    state: "ready",
  } as StationState);
  const [connected, setConnected] = useState(configured);
  const [connectionError, setConnectionError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [presentation,setPresentation] = useState<BallotPresentation | null>(null);
  const [presentationError,setPresentationError] = useState("");
  const [finishing,setFinishing] = useState(false);
  const [finishError,setFinishError] = useState("");
  const [choice, setChoice] = useState("");
  const [expiredState, setExpiredState] = useState<StationState | null>(null);
  const expired = expiredState === state;
  useEffect(()=>{
    if(!connected) return;
    let cancelled=false;
    const form=new FormData();form.set("operation","presentation");
    void boothAction({state:"ready"},form).then(result=>{
      if(cancelled)return;
      setPresentation(result.presentation??null);
      setPresentationError(result.presentation?"":"Las imágenes estarán disponibles cuando el comité abra la elección y actualice su pantalla de votación.");
    }).catch(()=>{if(!cancelled)setPresentationError("No se pudieron cargar las imágenes. Consulta al comité.");});
    return ()=>{cancelled=true;};
  },[connected,state.state]);

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
        <>
          {presentation && <header className="ballot-school-heading">{presentation.logo && <img src={presentation.logo} alt="Insignia del colegio" />}<div><span>ELECCIONES DEL MUNICIPIO ESCOLAR</span><h2>{presentation.school}</h2></div></header>}
          {presentationError && <p className="notice">{presentationError}</p>}
          <details className="booth-organizer-tools"><summary>Habilitación del equipo · solo comité</summary><button
            className="button secondary"
            onClick={() => {
              setConnected(false);
              setChoice("");
            }}
          >
            Cambiar habilitación del equipo (solo comité)
          </button></details>
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
              <div className="ballot-voting-grid">{state.lists?.map((l) => {
                const visual=presentation?.lists.find(item=>item.id===l.id);
                return <label key={l.id} className={`ballot-voting-card ${choice===l.id?"selected":""}`}>
                  <input type="radio" name="choice" value={l.id} checked={choice===l.id} onChange={()=>setChoice(l.id)} required />
                  <span className="ballot-voting-photo">{visual?.photo ? <img src={visual.photo} alt={`Fotografía de ${l.mayor??l.name}`}/>:<UserRound size={64}/>}<span className="ballot-party-symbol">{visual?.symbol ? <img src={visual.symbol} alt={`Símbolo de ${l.name}`}/>:<Vote size={28}/>}</span></span>
                  <span className="ballot-number">N.º {l.number}</span><strong>{l.name}</strong><span>{l.mayor??"Candidatura escolar"}</span>
                </label>;
              })}</div>
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
              <form action={async form => {
                setFinishing(true);setFinishError("");
                try {
                  const result=await boothAction(state,form);
                  if(!result.error && result.state==="ready") window.location.assign("/");
                  else setFinishError(result.error??"No se pudo limpiar la pantalla. Comprueba el estado antes de continuar.");
                } catch {setFinishError("No se pudo confirmar la limpieza. Vuelve a comprobar el estado.");}
                finally {setFinishing(false);}
              }}>
                <input type="hidden" name="operation" value="finish" />
                <button disabled={busy || finishing} className="button primary">
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
        </>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {finishError && <p role="alert">{finishError}</p>}
    </section>
  );
}
