"use client";
import Link from "next/link";
import { useState } from "react";
import { LockKeyhole, Download } from "lucide-react";
import { useElectoralDemo } from "./electoral-context";
import { institution } from "@/lib/institution";
import { makeDemoResults } from "@/lib/electoral/results";
export function ElectoralResults() {
  const { state, slates } = useElectoralDemo();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (state !== "closed")
    return (
      <section className="panel">
        <LockKeyhole size={30} />
        <h2>Resultados bloqueados hasta el cierre</h2>
        <p>
          En la demostración, simula la apertura y el cierre desde
          Administración. En PostgreSQL, la función de resultados rechaza la
          consulta antes de closed, incluso para administradores. Los votos
          individuales nunca se exponen a los roles de aplicación.
        </p>
        <Link className="button primary" href="/administracion">
          Ir al panel administrativo
        </Link>
      </section>
    );
  const results = makeDemoResults(slates);
  const leaders = results.lists.filter((l) => l.winner);
  async function download(kind: "pdf" | "xlsx") {
    setBusy(true);
    try {
      const exports = await import("@/lib/electoral/results");
      const bytes =
        kind === "pdf"
          ? await exports.exportResultsPdf(results, institution.name)
          : await exports.exportResultsExcel(results);
      const blob = new Blob([new Uint8Array(bytes)], {
        type:
          kind === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acta-demostracion-2026.${kind}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("No fue posible generar la exportación de demostración.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        ELECCIÓN FICTICIA CERRADA · Cifras de ejemplo independientes de la
        pantalla de votación. No representan una elección real.
      </div>
      <div className="stats-grid">
        <div className="stat">
          <div>
            <strong>
              {results.voters} / {results.electors}
            </strong>
            <span>
              Participación ficticia · {results.participation.toFixed(1)} %
            </span>
          </div>
        </div>
        <div className="stat">
          <div>
            <strong>{results.blank}</strong>
            <span>Votos en blanco ficticios</span>
          </div>
        </div>
        <div className="stat">
          <div>
            <strong>{results.pending}</strong>
            <span>Pendientes ficticios</span>
          </div>
        </div>
      </div>
      <section className="panel section">
        <div className="section-header">
          <div>
            <h2>Distribución ilustrativa</h2>
            <p>Porcentajes sobre votos emitidos, incluidos blancos.</p>
          </div>
          <span className="badge">Cierre simulado</span>
        </div>
        {results.lists.map((l, i) => (
          <div className="result-row" key={l.id}>
            <div className="result-label">
              <div>
                <span className="small-label">LISTA {l.number}</span>
                <h3>{l.name}</h3>
              </div>
              <div>
                <strong>{l.percentage.toFixed(1)} %</strong>
                <span>{l.votes} preferencias ficticias</span>
              </div>
            </div>
            <div
              className="result-track"
              role="meter"
              aria-label={l.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(l.percentage.toFixed(1))}
            >
              <div
                style={{
                  width: `${l.percentage}%`,
                  background: slates[i].color,
                }}
              />
            </div>
          </div>
        ))}
        <div className="result-row">
          <h3>En blanco</h3>
          <p>
            {results.blank} votos ficticios ·{" "}
            {results.blank_percentage.toFixed(1)} %
          </p>
          <div
            className="result-track"
            role="meter"
            aria-label="En blanco"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(results.blank_percentage.toFixed(1))}
          >
            <div
              style={{
                width: `${results.blank_percentage}%`,
                background: "#8190a2",
              }}
            />
          </div>
        </div>
        <div className="notice">
          {leaders.length > 1
            ? `Empate entre listas: ${leaders.map((l) => l.name).join(", ")}`
            : leaders.length
              ? `Lista con mayor votación ficticia: ${leaders[0].name}`
              : "Sin lista ganadora"}
          . La proclamación requiere reglas y validación del comité electoral.
        </div>
        <div className="roll-actions">
          <button
            className="button primary"
            disabled={busy}
            onClick={() => download("pdf")}
          >
            <Download size={16} /> Descargar acta PDF ficticia
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => download("xlsx")}
          >
            Exportar resultados Excel ficticios
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </>
  );
}
