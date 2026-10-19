"use client";
import { useState } from "react";
import Link from "next/link";
import { useElectoralDemo } from "./electoral-context";
import {
  validateSlate,
  type Slate,
  type Candidate,
} from "@/lib/electoral/types";
export function ElectoralAdmin() {
  const { slates, setSlates, state, setState, electors } = useElectoralDemo();
  const [draft, setDraft] = useState<Slate | null>(null);
  const [message, setMessage] = useState("");
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || state !== "draft") return;
    const errors = validateSlate(draft);
    if (slates.some((s) => s.id !== draft.id && s.number === draft.number))
      errors.push("El número de lista ya existe.");
    if (errors.length) {
      setMessage(errors.join(" "));
      return;
    }
    setSlates(
      slates.some((s) => s.id === draft.id)
        ? slates.map((s) => (s.id === draft.id ? draft : s))
        : [...slates, draft],
    );
    setDraft(null);
    setMessage("Lista ficticia guardada solo en memoria.");
  }
  function candidate(index: number, patch: Partial<Candidate>) {
    if (draft)
      setDraft({
        ...draft,
        candidates: draft.candidates.map((c, i) =>
          i === index ? { ...c, ...patch } : c,
        ),
      });
  }
  return (
    <section className="panel section">
      <h2>Gestión electoral de demostración</h2>
      <div className="notice">
        Esta vista no autentica personal ni gestiona datos reales. Las
        operaciones SQL equivalentes sí exigen membresía administrativa. Todo
        cambio aquí se pierde al recargar.
      </div>
      <div className="roll-actions">
        <span className="badge">
          Estado ficticio:{" "}
          {state === "draft"
            ? "Borrador"
            : state === "open"
              ? "Abierta"
              : "Cerrada"}
        </span>
        <button
          className="button primary"
          disabled={
            state !== "draft" ||
            Boolean(draft) ||
            electors.length !== 230 ||
            !slates.length ||
            slates.some((s) => validateSlate(s).length > 0)
          }
          onClick={() => {
            setState("open");
            setMessage(
              "Apertura ficticia. No habilita la emisión de votos oficiales.",
            );
          }}
        >
          Simular apertura electoral
        </button>
        <button
          className="button secondary"
          disabled={state !== "open"}
          onClick={() => {
            setState("closed");
            setMessage(
              "Cierre ficticio. Los resultados mostrados son ejemplos independientes de la votación.",
            );
          }}
        >
          Simular cierre electoral
        </button>
        <Link className="text-link" href="/resultados">
          Consultar resultados
        </Link>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="table-scroll">
        <table aria-label="Listas administradas">
          <thead>
            <tr>
              <th>Lista</th>
              <th>Símbolo</th>
              <th>Integrantes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {slates.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.number}. {s.name}
                </td>
                <td>{s.symbol}</td>
                <td>{s.candidates.length}</td>
                <td>
                  <button
                    className="button secondary"
                    disabled={state !== "draft"}
                    onClick={() => {
                      setDraft(structuredClone(s));
                      setMessage("");
                    }}
                  >
                    Editar lista {s.number}
                  </button>{" "}
                  <button
                    className="button secondary"
                    disabled={state !== "draft" || Boolean(draft)}
                    onClick={() => {
                      setSlates(slates.filter((l) => l.id !== s.id));
                      setMessage("Lista ficticia eliminada.");
                    }}
                  >
                    Eliminar lista {s.number}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="button primary"
        disabled={state !== "draft" || Boolean(draft) || slates.length >= 99}
        onClick={() => {
          const id = crypto.randomUUID();
          setDraft({
            id,
            number: Array.from({ length: 99 }, (_, i) => i + 1).find(
              (n) => !slates.some((s) => s.number === n),
            )!,
            name: "Lista ficticia nueva",
            symbol: "Árbol",
            proposals: ["Propuesta ficticia"],
            color: "#147d62",
            motto: "Participación con responsabilidad",
            candidates: [
              {
                id: `${id}-0`,
                name: "Alcalde ficticio",
                role: "alcalde",
                position: 0,
                title: "Alcaldía escolar",
                grade: 4,
                section: "A",
                photo: "/candidatos/valeria.jpg",
              },
              {
                id: `${id}-1`,
                name: "Regidor ficticio",
                role: "regidor",
                position: 1,
                title: "Regiduría de cultura",
                grade: 3,
                section: "B",
                photo: "/candidatos/mateo.jpg",
              },
            ],
          });
        }}
      >
        Añadir lista ficticia
      </button>
      {draft && (
        <form className="slate-form" onSubmit={save}>
          <h3>Editar lista ficticia</h3>
          <label htmlFor="slate-name">Nombre de lista</label>
          <input
            id="slate-name"
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <label htmlFor="slate-number">Número electoral</label>
          <input
            id="slate-number"
            type="number"
            min={1}
            max={99}
            value={draft.number}
            onChange={(e) =>
              setDraft({ ...draft, number: Number(e.target.value) })
            }
          />
          <label htmlFor="slate-symbol">Símbolo electoral</label>
          <select
            id="slate-symbol"
            value={draft.symbol}
            onChange={(e) =>
              setDraft({ ...draft, symbol: e.target.value as Slate["symbol"] })
            }
          >
            <option>Árbol</option>
            <option>Libro</option>
            <option>Sol</option>
          </select>
          <label htmlFor="slate-proposals">Propuestas (una por línea)</label>
          <textarea
            id="slate-proposals"
            required
            value={draft.proposals.join("\n")}
            onChange={(e) =>
              setDraft({ ...draft, proposals: e.target.value.split("\n") })
            }
          />
          {draft.candidates.map((c, index) => (
            <fieldset className="candidate-editor" key={c.id}>
              <legend>
                {c.role === "alcalde"
                  ? "Alcaldía escolar"
                  : `Regiduría ${c.position}`}
              </legend>
              <label>
                Nombre ficticio
                <input
                  required
                  maxLength={120}
                  value={c.name}
                  onChange={(e) => candidate(index, { name: e.target.value })}
                />
              </label>
              <label>
                Cargo
                <input
                  required
                  maxLength={100}
                  value={c.title}
                  onChange={(e) => candidate(index, { title: e.target.value })}
                />
              </label>
              <div className="roll-filters">
                <label>
                  Grado
                  <select
                    value={c.grade}
                    onChange={(e) =>
                      candidate(index, { grade: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>
                        {g}.º
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sección
                  <select
                    value={c.section}
                    onChange={(e) =>
                      candidate(index, { section: e.target.value })
                    }
                  >
                    {["A", "B", "C"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Fotografía referencial
                <select
                  value={c.photo}
                  onChange={(e) => candidate(index, { photo: e.target.value })}
                >
                  <option value="/candidatos/valeria.jpg">Referencia 1</option>
                  <option value="/candidatos/mateo.jpg">Referencia 2</option>
                  <option value="/candidatos/lucas.jpg">Referencia 3</option>
                </select>
              </label>
              {c.role === "regidor" && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      candidates: draft.candidates.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  Quitar regiduría {c.position}
                </button>
              )}
            </fieldset>
          ))}
          <div className="roll-actions">
            <button
              type="button"
              className="button secondary"
              disabled={
                draft.candidates.filter((c) => c.role === "regidor").length >=
                20
              }
              onClick={() => {
                const position = Array.from(
                  { length: 20 },
                  (_, i) => i + 1,
                ).find((n) => !draft.candidates.some((c) => c.position === n))!;
                setDraft({
                  ...draft,
                  candidates: [
                    ...draft.candidates,
                    {
                      id: crypto.randomUUID(),
                      name: "Regidor ficticio",
                      role: "regidor",
                      position,
                      title: "Regiduría escolar",
                      grade: 3,
                      section: "A",
                      photo: "/candidatos/lucas.jpg",
                    },
                  ],
                });
              }}
            >
              Añadir regidor
            </button>
            <button className="button primary" disabled={state !== "draft"}>
              Guardar lista ficticia
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setDraft(null)}
            >
              Cancelar lista
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
