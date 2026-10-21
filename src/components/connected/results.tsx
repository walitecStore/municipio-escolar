"use client";
import { useState } from "react";
import type { ElectoralResults } from "@/lib/electoral/types";
export function ConnectedResults({
  results,
  school,
  purpose,
  year,
  mayors = {},
  mode = "all",
}: {
  results: ElectoralResults;
  school: string;
  purpose: "test" | "official";
  year?: number;
  mayors?: Record<string, string>;
  mode?: "all" | "charts" | "documents";
}) {
  const roles = [
    "Director/a",
    "Presidencia del comité electoral",
    "Organización / apoyo electoral",
    "Presidencia de mesa",
    "Secretaría de mesa",
    "Vocal de mesa",
    "Representante de la lista ganadora",
  ];
  const [names, setNames] = useState<Record<string, string>>({});
  const [insignia, setInsignia] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(format: "pdf" | "xlsx") {
    setBusy(true);
    try {
      const exports = await import("@/lib/electoral/results");
      const data =
        format === "pdf"
          ? await exports.exportResultsPdf(results, school, purpose, {
              year,
              mayors,
              signatories: roles.map((role) => ({
                role,
                name: names[role] ?? "",
              })),
              insignia: insignia
                ? {
                    bytes: new Uint8Array(await insignia.arrayBuffer()),
                    type: insignia.type as "image/png" | "image/jpeg",
                  }
                : undefined,
            })
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
      {mode !== "documents" &&
        results.lists.map((l) => (
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
              <div
                style={{ width: `${l.percentage}%`, background: "#148065" }}
              />
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
      {mode !== "charts" && (
        <>
          <fieldset>
            <legend>Datos del acta para revisión y firma</legend>
            <p>
              Los nombres y la insignia se usan solo para esta descarga. No se
              guardan firmas ni se acredita participación de ONPE
              automáticamente.
            </p>
            <label>
              Insignia institucional (PNG o JPEG, hasta 1 MB)
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (
                    f &&
                    (f.size > 1024 * 1024 ||
                      !["image/png", "image/jpeg"].includes(f.type))
                  ) {
                    setError(
                      "Selecciona una insignia PNG o JPEG de hasta 1 MB.",
                    );
                    setInsignia(null);
                    e.target.value = "";
                  } else {
                    setInsignia(f ?? null);
                    setError("");
                  }
                }}
              />
            </label>
            {roles.map((role) => (
              <label key={role}>
                {role}
                <input
                  maxLength={120}
                  value={names[role] ?? ""}
                  onChange={(e) =>
                    setNames({ ...names, [role]: e.target.value })
                  }
                />
              </label>
            ))}
          </fieldset>
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
      )}
    </>
  );
}
