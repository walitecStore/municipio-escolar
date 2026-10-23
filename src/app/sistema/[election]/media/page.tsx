import {
  WorkspaceHeading,
  WorkspaceNote,
} from "@/components/connected/workspace-ui";
import { protectedElection } from "@/lib/connected/session";
import { MediaLibraryManager } from "@/components/connected/media-library";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const { election } = await protectedElection((await params).election, true);
  return (
    <section className="panel">
      <WorkspaceHeading
        icon="images"
        eyebrow="IMÁGENES DE TU COMUNIDAD"
        title="Fotografías y símbolos"
      >
        Guarda imágenes autorizadas de tu institución desde el celular o la
        computadora.
      </WorkspaceHeading>
      <WorkspaceNote title="Tu biblioteca privada de imágenes">
        Guarda fotos y símbolos aquí y selecciónalos al registrar candidatos con
        Usar imagen guardada. También puedes subirlos directamente desde tu equipo.
      </WorkspaceNote>
      <MediaLibraryManager election={election.id} editable={election.state === "draft"} />
    </section>
  );
}
