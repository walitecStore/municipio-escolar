import { protectedElection } from "@/lib/connected/session";
import { resultsSchema } from "@/lib/connected/data";
import { ConnectedResults } from "@/components/connected/results";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election } = await protectedElection(id, true);
  if (election.state !== "closed")
    return (
      <section className="panel">
        <h1>Resultados bloqueados</h1>
        <p>
          La elección no ha cerrado. PostgreSQL también rechaza la consulta
          antes del cierre, incluso para administradores.
        </p>
      </section>
    );
  const response = await client.rpc("get_electoral_results", {
    p_election: id,
  });
  if (response.error)
    throw new Error("Resultados no disponibles para esta sesión.");
  return (
    <section className="panel">
      <h1>Resultados de PostgreSQL</h1>
      <p>
        Elección cerrada ·{" "}
        {election.purpose === "test"
          ? "PRUEBAS: sin validez oficial"
          : "Exportación para revisión y firma del comité"}
      </p>
      <ConnectedResults
        results={resultsSchema.parse(response.data)}
        school={election.school}
        purpose={election.purpose}
      />
    </section>
  );
}
