import { protectedElection } from "@/lib/connected/session";
import { rollSchema } from "@/lib/connected/data";
import { ConnectedCredentials } from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election } = await protectedElection(id, true);
  const response = await client.rpc("get_electoral_roll", { p_election: id });
  if (response.error) throw new Error("Padrón no disponible.");
  return (
    <section className="panel">
      <h1>Credenciales individuales</h1>
      <ConnectedCredentials
        election={election}
        students={rollSchema.parse(response.data)}
      />
    </section>
  );
}
