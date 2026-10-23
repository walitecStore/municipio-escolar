import Link from "next/link";
import { protectedElection } from "@/lib/connected/session";
import { listsSchema } from "@/lib/connected/data";
import {
  WorkspaceHeading,
  WorkspaceNote,
} from "@/components/connected/workspace-ui";
import { SlateWizard } from "@/components/connected/slate-wizard";
import {
  ConnectedCandidateEditor,
} from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election } = await protectedElection(id, true);
  const [response, availability] = await Promise.all([
    client.rpc("get_electoral_lists", { p_election: id }),
    client.rpc("get_slate_registration_receipt", {
      p_election: id,
      p_request: "00000000-0000-4000-8000-000000000000",
    }),
  ]);
  if (response.error)
    throw new Error("No se pudieron consultar los registros de esta elección.");
  const lists = listsSchema.parse(response.data);
  return (
    <>
      <WorkspaceHeading
        icon="team"
        eyebrow="INSCRIPCIÓN ELECTORAL PASO A PASO"
        title="Registrar candidato y plana de regiduría"
      >
        Completa los datos del alcalde, su partido y su equipo. La numeración se
        asigna automáticamente.
      </WorkspaceHeading>
      {election.state === "draft" ? (
        availability.error ? (
          <WorkspaceNote title="Registro guiado pendiente de actualización">
            El responsable debe aplicar la actualización de base de datos 010
            para habilitar este asistente. Los registros existentes se conservan
            y puedes consultarlos en Mostrar candidatos.
          </WorkspaceNote>
        ) : (
          <SlateWizard election={id} />
        )
      ) : (
        <WorkspaceNote title="El registro está cerrado">
          Solo se pueden inscribir o corregir candidatos mientras la elección
          está en borrador.
        </WorkspaceNote>
      )}
      {!!lists.length && (
        <details className="panel section existing-candidate-management">
          <summary>Corregir registros existentes</summary>
          <p>
            Edita al candidato a la alcaldía o a sus regidores, o agrega un
            regidor a una candidatura ya registrada.
          </p>
          <section id="registrar-candidato">
            <h2>Editar candidato y regidores</h2>
            <ConnectedCandidateEditor election={election} lists={lists} />
          </section>
        </details>
      )}
      <Link className="button secondary" href={`/sistema/${id}/candidatos`}>
        Mostrar candidatos
      </Link>
    </>
  );
}
