import Link from "next/link";
import { protectedElection } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
import { listsSchema } from "@/lib/connected/data";
import { WorkspaceHeading } from "@/components/connected/workspace-ui";
import { CandidateGallery } from "@/components/connected/candidate-gallery";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election, session } = await protectedElection(id);
  const result = await client.rpc("get_electoral_lists", { p_election: id });
  if (result.error)
    throw new Error("Candidatos no disponibles para esta cuenta o fase.");
  const lists = listsSchema.parse(result.data);
  return (
    <>
      <WorkspaceHeading
        icon="team"
        eyebrow={election.school}
        title="Mostrar candidatos"
        action={
          isStaff(session) && election.state === "draft" ? (
            <Link className="button primary" href={`/sistema/${id}/listas`}>
              Registrar candidato y plana de regiduría
            </Link>
          ) : undefined
        }
      >
        Conoce a los candidatos, sus partidos y los integrantes de sus equipos.
      </WorkspaceHeading>
      <CandidateGallery election={id} lists={lists} />
    </>
  );
}
