import Link from "next/link";
import { protectedElection } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
import { ConnectedElectionState } from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { election, session } = await protectedElection(id);
  return (
    <section className="panel">
      <h1>{election.school}</h1>
      <p>
        {election.year} · Estado: {election.state} · Modo:{" "}
        {election.purpose === "test" ? "Pruebas" : "Oficial"}
      </p>
      <div className="roll-actions">
        {isStaff(session) &&
          [
            ["padron", "Padrón"],
            ["listas", "Listas y candidatos"],
            ["credenciales", "Credenciales"],
            ["resultados", "Resultados"],
            ["media", "Fotografías privadas"],
          ].map(([path, title]) => (
            <Link
              className="button secondary"
              key={path}
              href={`/sistema/${id}/${path}`}
            >
              {title}
            </Link>
          ))}
        <Link className="button primary" href={`/sistema/${id}/votar`}>
          Pantalla de votación
        </Link>
      </div>
      {isStaff(session) && <ConnectedElectionState election={election} />}
    </section>
  );
}
