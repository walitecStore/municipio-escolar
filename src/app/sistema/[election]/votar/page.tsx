import Link from "next/link";
import { protectedElection } from "@/lib/connected/session";
import { integrationConfig } from "@/lib/connected/env";
import { votingAllowed } from "@/lib/connected/policy";
import { listsSchema } from "@/lib/connected/data";
import { ConnectedVote } from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election } = await protectedElection(id);
  const config = integrationConfig()!;
  const allowed = votingAllowed(config, election);
  const status = await client.rpc("electoral_vote_status", { p_election: id });
  if (status.error) throw new Error("No se pudo comprobar la participación.");
  const response =
    election.state === "open"
      ? await client.rpc("get_electoral_lists", { p_election: id })
      : { data: [], error: null };
  if (response.error) throw new Error("No se pudo consultar la cédula.");
  return (
    <section className="panel">
      <h1>Votación conectada</h1>
      <p>
        Modo:{" "}
        {election.purpose === "test"
          ? "Pruebas con datos ficticios"
          : "Elección oficial aprobada"}
        . Revisa las propuestas antes de elegir.
      </p>
      {election.state !== "draft" && (
        <Link className="text-link" href={`/sistema/${id}/listas`}>
          Consultar listas y candidatos autorizados
        </Link>
      )}
      <ConnectedVote
        election={election}
        lists={listsSchema.parse(response.data)}
        allowed={allowed}
        participated={status.data === true}
      />
    </section>
  );
}
