import "server-only";
import { protectedElection } from "./session";
import { resultsSchema, listsSchema } from "./data";
export async function closedElectionReport(id: string) {
  const access = await protectedElection(id, true);
  if (access.election.state !== "closed")
    return { election: access.election, results: null, mayors: {} };
  const response = await access.client.rpc("get_electoral_results", {
    p_election: id,
  });
  if (response.error)
    throw new Error("Resultados no disponibles para esta sesión.");
  const lists = await access.client.rpc("get_electoral_lists", {
    p_election: id,
  });
  if (lists.error)
    throw new Error("No se pudieron verificar las candidaturas del acta.");
  return {
    election: access.election,
    results: resultsSchema.parse(response.data),
    mayors: Object.fromEntries(
      listsSchema
        .parse(lists.data)
        .map((l) => [
          l.id,
          l.candidates.find((c) => c.role === "alcalde")?.name ??
            "No consignado",
        ]),
    ),
  };
}
