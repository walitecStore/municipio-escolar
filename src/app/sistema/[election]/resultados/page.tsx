import { protectedElection } from "@/lib/connected/session";
import { resultsSchema, listsSchema } from "@/lib/connected/data";
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
  const listsResponse = await client.rpc("get_electoral_lists", {
    p_election: id,
  });
  if (listsResponse.error)
    throw new Error("No se pudieron verificar las candidaturas del acta.");
  const mayors = Object.fromEntries(
    listsSchema
      .parse(listsResponse.data)
      .map((l) => [
        l.id,
        l.candidates.find((c) => c.role === "alcalde")?.name ?? "No consignado",
      ]),
  );
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
        year={election.year}
        mayors={mayors}
        purpose={election.purpose}
      />
    </section>
  );
}
