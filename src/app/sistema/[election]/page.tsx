import Link from "next/link";
import { protectedElection } from "@/lib/connected/session";
import { integrationConfig } from "@/lib/connected/env";
import { openingAllowed } from "@/lib/connected/policy";
import { isStaff } from "@/lib/connected/policy";
import { ConnectedElectionState } from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { election, session } = await protectedElection(id);
  const config = integrationConfig();
  return (
    <section className="panel">
      <h1>{election.school}</h1>
      <p>
        {election.year} · Estado: {election.state} · Modo:{" "}
        {election.purpose === "test"
          ? "Pruebas · datos ficticios"
          : "Institucional · preparación oficial"}
      </p>
      <div className="roll-actions">
        {isStaff(session) &&
          [
            ["padron", "Padrón"],
            ["listas", "Listas y candidatos"],
            ["credenciales", "Credenciales"],
            ["configuracion", "Configuración"],
            ["presencial", "Mesas · DNI"],
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
        <Link
          className="button primary"
          href={
            election.supervised_dni ? "/sistema/mesa" : `/sistema/${id}/votar`
          }
        >
          Pantalla de votación
        </Link>
      </div>
      {isStaff(session) && (
        <ConnectedElectionState
          election={election}
          canOpen={!!config && openingAllowed(config, election)}
        />
      )}
    </section>
  );
}
