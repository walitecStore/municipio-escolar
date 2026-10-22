import {
  WorkspaceHeading,
  WorkspaceNote,
} from "@/components/connected/workspace-ui";
import { protectedElection } from "@/lib/connected/session";
import { ConnectedMediaUpload } from "@/components/connected/forms";
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
      <p>
        Las imágenes se guardan de forma privada y se eliminan sus datos de
        ubicación. Puedes cargar símbolos y fotos directamente al registrar
        listas y candidatos.
      </p>
      <WorkspaceNote title="Para vincular una imagen a una candidatura">
        Usa los campos de imagen en Registrar candidato y plana de regiduría: la
        fotografía o el símbolo se asignan al guardar el registro.
      </WorkspaceNote>
      <ConnectedMediaUpload election={election} />
    </section>
  );
}
