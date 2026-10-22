import {
  WorkspaceHeading,
  WorkspaceNote,
} from "@/components/connected/workspace-ui";
import { protectedElection } from "@/lib/connected/session";
import { InstitutionalSettings } from "@/components/connected/institutional-settings";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const { election } = await protectedElection((await params).election, true);
  return (
    <section className="panel">
      <WorkspaceHeading
        icon="settings"
        eyebrow="LOS DATOS DE TU ELECCIÓN"
        title="Configuración institucional"
      >
        Revisa el nombre del colegio y la cantidad definitiva de estudiantes que
        participarán.
      </WorkspaceHeading>
      <p>
        Estos datos se usan en el padrón, las condiciones de apertura y el acta
        electoral. El total debe corresponder al padrón definitivo; no lo
        reduzcas para omitir estudiantes pendientes de carga.
      </p>
      <InstitutionalSettings election={election} />
      <WorkspaceNote title="Tu institución también aparece en el acta">
        Después del cierre, entra a Actas y documentos para agregar la insignia
        y los nombres de quienes firmarán.
      </WorkspaceNote>
    </section>
  );
}
