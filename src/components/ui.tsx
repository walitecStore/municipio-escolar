import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { lists } from "@/lib/demo";
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
  return (
    <div className="candidate-grid">
      {lists.map((list) => (
        <article className="candidate-card" key={list.id}>
          <div
            className="candidate-photo"
            style={{ background: `${list.color}12` }}
          >
            <Image
              src={list.photo}
              alt={`Fotografía referencial para la candidatura ficticia de ${list.candidate}`}
              width={260}
              height={210}
            />
            <span className="list-number">LISTA {list.id}</span>
            <span className="photo-note">Foto referencial</span>
          </div>
          <div className="candidate-body">
            <span className="small-label" style={{ color: list.color }}>
              {list.name}
            </span>
            <h3>{list.candidate}</h3>
            <p>{list.grade} · Candidatura a la alcaldía</p>
            <div className="candidate-motto">“{list.motto}”</div>
            <details>
              <summary>
                Conoce sus propuestas <ArrowUpRight size={15} />
              </summary>
              <ul>
                {list.proposals.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}
