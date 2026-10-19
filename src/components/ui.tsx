"use client";
import Image from "next/image";
import { ArrowUpRight, TreePine, BookOpen, Sun } from "lucide-react";
import { useElectoralDemo } from "./electoral-context";
export function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function CandidateCards() {
  const { slates } = useElectoralDemo();
  return (
    <div className="candidate-grid">
      {slates.map((list) => {
        const mayor = list.candidates.find((c) => c.role === "alcalde")!;
        const SymbolIcon =
          list.symbol === "Árbol"
            ? TreePine
            : list.symbol === "Libro"
              ? BookOpen
              : Sun;
        return (
          <article className="candidate-card" key={list.id}>
            <div
              className="candidate-photo"
              style={{ background: `${list.color}12` }}
            >
              <Image
                src={mayor.photo}
                alt={`Fotografía referencial para la candidatura ficticia de ${mayor.name}`}
                width={260}
                height={210}
              />
              <span className="list-number">
                LISTA {String(list.number).padStart(2, "0")} ·{" "}
                <SymbolIcon
                  size={12}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                {list.symbol}
              </span>
              <span className="photo-note">Foto referencial</span>
            </div>
            <div className="candidate-body">
              <span className="small-label" style={{ color: list.color }}>
                {list.name}
              </span>
              <h3>{mayor.name}</h3>
              <p>
                {mayor.grade}.º {mayor.section} · Candidatura a la alcaldía
              </p>
              <div className="candidate-motto">“{list.motto}”</div>
              <div
                className="council-avatars"
                aria-label="Fotografías referenciales de regidores"
              >
                {list.candidates
                  .filter((c) => c.role === "regidor")
                  .map((c) => (
                    <Image
                      key={c.id}
                      src={c.photo}
                      alt={`Fotografía referencial de ${c.name}`}
                      width={34}
                      height={34}
                    />
                  ))}
              </div>
              <details>
                <summary>
                  Conoce sus propuestas <ArrowUpRight size={15} />
                </summary>
                <ul>
                  {list.proposals.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <h4>Equipo de regidores</h4>
                <ul>
                  {list.candidates
                    .filter((c) => c.role === "regidor")
                    .map((c) => (
                      <li key={c.id}>
                        {c.name} · {c.title} · {c.grade}.º {c.section}
                      </li>
                    ))}
                </ul>
              </details>
            </div>
          </article>
        );
      })}
    </div>
  );
}
