import Image from "next/image";
import { Flag, UserRound, UsersRound } from "lucide-react";
import type { ConnectedList } from "@/lib/connected/data";
export function CandidateGallery({
  election,
  lists,
}: {
  election: string;
  lists: ConnectedList[];
}) {
  const registered = lists.filter((l) =>
    l.candidates.some((c) => c.role === "alcalde"),
  );
  if (!registered.length)
    return (
      <div className="directory-empty">
        <UsersRound size={38} aria-hidden="true" />
        <strong>Aún no hay candidatos registrados</strong>
        <p>Los candidatos aparecerán aquí cuando finalices su inscripción.</p>
      </div>
    );
  const media = (path: string) =>
    `/sistema/${election}/media/archivo?path=${encodeURIComponent(path)}`;
  return (
    <div
      className={`candidate-display-grid ${registered.length === 4 ? "four" : registered.length === 1 ? "single" : ""}`}
    >
      {registered.map((list) => {
        const mayor = list.candidates.find((c) => c.role === "alcalde")!;
        const regidors = list.candidates
          .filter((c) => c.role === "regidor")
          .sort((a, b) => a.position - b.position);
        return (
          <article
            className="candidate-display-card"
            key={list.id}
            id={`candidato-${list.id}`}
          >
            <div className="candidate-display-photo">
              {mayor.photo_path ? (
                <Image
                  unoptimized
                  src={media(mayor.photo_path)}
                  alt={`Fotografía de ${mayor.name}`}
                  width={600}
                  height={450}
                />
              ) : (
                <div className="candidate-photo-empty">
                  <UserRound size={70} aria-hidden="true" />
                  <span>Fotografía pendiente</span>
                </div>
              )}
              <span className="candidate-party-number">
                N.º {list.number ?? "Pendiente"}
              </span>
              <div className="candidate-display-symbol">
                {list.symbol_path ? (
                  <Image
                    unoptimized
                    src={media(list.symbol_path)}
                    width={90}
                    height={90}
                    alt={`Símbolo de ${list.name}`}
                  />
                ) : (
                  <Flag size={32} aria-label="Símbolo pendiente" />
                )}
              </div>
            </div>
            <div className="candidate-display-body">
              <p className="candidate-party-name">{list.name}</p>
              <h2>{mayor.name}</h2>
              <p className="candidate-position-title">
                Candidato a la alcaldía escolar
              </p>
              <details className="candidate-team-details">
                <summary>
                  <UsersRound size={18} aria-hidden="true" />
                  Ver plana de regiduría · {regidors.length}
                </summary>
                {regidors.length ? (
                  <ul>
                    {regidors.map((c) => (
                      <li key={c.id}>
                        <strong>{c.name}</strong>
                        <span>{c.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Plana de regiduría pendiente.</p>
                )}
                {!!list.proposals.length && (
                  <>
                    <h3>Propuestas</h3>
                    <ul>
                      {list.proposals.map((p, n) => (
                        <li key={n}>{p}</li>
                      ))}
                    </ul>
                  </>
                )}
              </details>
            </div>
          </article>
        );
      })}
    </div>
  );
}
