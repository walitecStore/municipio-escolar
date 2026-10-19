"use client";
import { useState } from "react";
import { useElectoralDemo } from "./electoral-context";
export function CredentialDemo() {
  const { electors, setElectors, state } = useElectoralDemo();
  const [code, setCode] = useState("DEMO-001");
  const [supervised, setSupervised] = useState(false);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const alreadyVoted = electors.find((s) => s.code === code)?.voted ?? false;
  const [credentials, setCredentials] = useState<
    Record<
      string,
      { hash: string; expiresAt: number; used: boolean; delivered: boolean }
    >
  >({});
  async function issue() {
    if (!supervised || alreadyVoted || state === "closed") return;
    setBusy(true);
    setToken("");
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const value = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value),
      );
      const hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setCredentials((c) => ({
        ...c,
        [code]: {
          hash,
          expiresAt: Date.now() + 86400000,
          used: false,
          delivered: false,
        },
      }));
      setToken(value);
      setMessage(
        "Token ficticio individual generado. El anterior queda sustituido en esta simulación. No sirve para votar oficialmente.",
      );
    } catch {
      setMessage("No se pudo generar la credencial local.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel section">
      <h2>Entrega y recuperación supervisada · demo</h2>
      <p>
        Solo electores ficticios. Generación aleatoria local de 256 bits, hash
        en memoria y caducidad de 24 horas. No se envían ni se registran tokens.
        Esta pantalla no sustituye la autorización del servidor.
      </p>
      <label htmlFor="credential-elector">Elector ficticio</label>
      <select
        id="credential-elector"
        disabled={busy}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setToken("");
          setMessage("");
          setSupervised(false);
        }}
      >
        {electors.map((s) => (
          <option key={s.code} value={s.code}>
            {s.code}
          </option>
        ))}
      </select>
      <label className="blank-vote">
        <input
          type="checkbox"
          disabled={busy}
          checked={supervised}
          onChange={(e) => {
            setSupervised(e.target.checked);
            setToken("");
          }}
        />{" "}
        Confirmo una entrega individual supervisada de demostración
      </label>
      <div className="roll-actions">
        <button
          className="button primary"
          disabled={
            !supervised ||
            busy ||
            alreadyVoted ||
            state === "closed" ||
            !electors.some((s) => s.code === code)
          }
          onClick={issue}
        >
          {credentials[code]
            ? "Recuperar credencial ficticia"
            : "Generar credencial ficticia"}
        </button>
        <button
          className="button secondary"
          disabled={
            !credentials[code]?.delivered ||
            alreadyVoted ||
            busy ||
            state !== "open"
          }
          onClick={() => {
            setCredentials((c) => ({
              ...c,
              [code]: { ...c[code], used: true },
            }));
            setElectors(
              electors.map((s) =>
                s.code === code ? { ...s, voted: true } : s,
              ),
            );
            setToken("");
            setMessage(
              "Participación ficticia marcada para probar el bloqueo. No se emitió ningún voto.",
            );
          }}
        >
          Probar bloqueo por participación
        </button>
      </div>
      {token && (
        <div className="credential-reveal">
          <strong>Entrega individual · mostrar una sola vez</strong>
          <p>
            Credencial ficticia para {code}; no compartir ni incluir en
            capturas.
          </p>
          <input
            aria-label="Token ficticio de entrega única"
            readOnly
            value={token}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="button secondary"
            onClick={() => {
              setCredentials((c) => ({
                ...c,
                [code]: { ...c[code], delivered: true },
              }));
              setToken("");
              setMessage(
                "Entrega ficticia confirmada. El token se retiró de la vista.",
              );
            }}
          >
            Confirmar entrega y ocultar
          </button>
        </div>
      )}
      {alreadyVoted && (
        <p className="notice">
          Recuperación bloqueada: el elector ficticio ya participó.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </section>
  );
}
