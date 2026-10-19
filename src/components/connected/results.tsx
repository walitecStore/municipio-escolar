"use client";
import { useState } from "react";
import type { ElectoralResults } from "@/lib/electoral/types";
export function ConnectedResults({
  results,
  school,
  purpose,
}: {
  results: ElectoralResults;
  school: string;
  purpose: "test" | "official";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(format: "pdf" | "xlsx") {
    setBusy(true);
    try {
      const exports = await import("@/lib/electoral/results");
      const data =
        format === "pdf"
          ? await exports.exportResultsPdf(results, school, purpose)
          : await exports.exportResultsExcel(results, purpose);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(data)], {
          type:
            format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `recuento-cerrado.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("No se pudo generar la exportación.");
    } finally {
      setBusy(false);
    }
  }
  const leaders = results.lists.filter((l) => l.winner);
  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <div>
            <strong>
              {results.voters}/{results.electors}
            </strong>
            <span>Participación: {results.participation.toFixed(2)} %</span>
          </div>
        </div>
        <div className="stat">
          <div>
            <strong>{results.blank}</strong>
            <span>En blanco</span>
          </div>
        </div>
        <div className="stat">
          <div>
            <strong>{results.pending}</strong>
            <span>Pendientes</span>
          </div>
        </div>
      </div>
      {results.lists.map((l) => (
        <div className="result-row" key={l.id}>
          <div className="result-label">
            <h2>
              {l.number}. {l.name}
            </h2>
            <strong>
              {l.votes} votos · {l.percentage.toFixed(2)} %
            </strong>
          </div>
          <div
            className="result-track"
            role="meter"
            aria-label={l.name}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={l.percentage}
          >
            <div style={{ width: `${l.percentage}%`, background: "#148065" }} />
          </div>
        </div>
      ))}
      <p>
        Blancos: {results.blank} ({results.blank_percentage.toFixed(2)} %).
        Porcentajes sobre votos emitidos, incluidos blancos.
      </p>
      <p>
        {leaders.length > 1
          ? `Empate: ${leaders.map((l) => l.name).join(", ")}`
          : leaders.length
            ? `Lista con mayor votación: ${leaders[0].name}`
            : "Sin lista ganadora"}
        . La proclamación y las firmas corresponden al comité.
      </p>
      <div className="roll-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => download("pdf")}
        >
          Descargar acta del recuento
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => download("xlsx")}
        >
          Exportar recuento Excel
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
