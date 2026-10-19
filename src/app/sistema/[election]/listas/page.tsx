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
      <h1>Listas y candidaturas conectadas</h1>
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
          <section className="panel section">
            <h2>Gestionar listas</h2>
            <ConnectedListEditor election={election} lists={lists} />
          </section>
          <section className="panel section">
            <h2>Gestionar candidaturas</h2>
            <ConnectedCandidateEditor election={election} lists={lists} />
          </section>
        </>
      )}
    </>
  );
}
