import Link from "next/link";
import { UserPlus, Flag } from "lucide-react";
import Image from "next/image";
import { protectedElection } from "@/lib/connected/session";
import { listsSchema } from "@/lib/connected/data";
import { isStaff } from "@/lib/connected/policy";
import {
  ConnectedListEditor,
  ConnectedCandidateEditor,
} from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election, session } = await protectedElection(id);
  const response = await client.rpc("get_electoral_lists", { p_election: id });
  if (response.error)
    throw new Error("Listas no disponibles para esta cuenta o fase.");
  const lists = listsSchema.parse(response.data);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">CANDIDATURAS DE TU INSTITUCIÓN</div>
        <h1>Listas y candidatos</h1>
        <p>
          Registra primero una lista con su símbolo y después incorpora a sus
          candidatos.
        </p>
      </div>
      {isStaff(session) && election.state === "draft" && (
        <div className="registration-actions">
          <Link className="button secondary" href="#registrar-lista">
            <Flag size={20} aria-hidden="true" />
            Registrar lista y símbolo
          </Link>
          <Link className="button primary" href="#registrar-candidato">
            <UserPlus size={20} aria-hidden="true" />
            Registrar candidato
          </Link>
        </div>
      )}
      {!lists.length && (
        <section className="panel empty-election">
          <Flag size={36} aria-hidden="true" />
          <h2>Aún no hay listas registradas</h2>
          <p>
            Empieza por el nombre de la lista, su número electoral y su símbolo.
          </p>
        </section>
      )}
      {lists.map((l) => (
        <section className="panel section" key={l.id}>
          <h2>
            Lista {l.number} · {l.name}
          </h2>
          {l.symbol_path && (
            <Image
              unoptimized
              width={80}
              height={80}
              src={`/sistema/${id}/media/archivo?path=${encodeURIComponent(l.symbol_path)}`}
              alt="Símbolo electoral privado"
            />
          )}
          <ul>
            {l.proposals.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          {l.candidates.map((c) => (
            <div className="admin-link" key={c.id}>
              <span>
                {c.name} · {c.title} · {c.grade}.º {c.section}
              </span>
              {c.photo_path && (
                <Image
                  unoptimized
                  width={70}
                  height={70}
                  src={`/sistema/${id}/media/archivo?path=${encodeURIComponent(c.photo_path)}`}
                  alt={`Fotografía autorizada de ${c.name}`}
                />
              )}
            </div>
          ))}
        </section>
      ))}
      {isStaff(session) && (
        <>
          <section
            className="panel section registration-section"
            id="registrar-lista"
          >
            <span className="step-badge">PASO 1 · LISTA Y SÍMBOLO</span>
            <h2>Registrar lista</h2>
            <p>
              El símbolo identifica a toda la lista y aparecerá junto a ella en
              la votación.
            </p>
            <ConnectedListEditor election={election} lists={lists} />
          </section>
          <section
            className="panel section registration-section"
            id="registrar-candidato"
          >
            <span className="step-badge">PASO 2 · CANDIDATOS</span>
            <h2>Registrar candidato</h2>
            <p>
              Ingresa sus datos y selecciona la lista o partido escolar que
              representa.
            </p>
            {!lists.length && (
              <p className="notice">
                Primero registra una lista en el paso 1 para poder agregar sus
                candidatos.
              </p>
            )}
            <ConnectedCandidateEditor election={election} lists={lists} />
          </section>
        </>
      )}
    </>
  );
}
