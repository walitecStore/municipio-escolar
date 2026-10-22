import { WorkspaceHeading } from "@/components/connected/workspace-ui";
import { institutionContextSchema } from "@/lib/connected/institutions";
import { demonstrationsEnabled, publicInstitution } from "@/lib/platform";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/connected/policy";
import { verifiedSession } from "@/lib/connected/session";
import { ConnectedCreateElection } from "@/components/connected/forms";
export default async function Page() {
  const { session, client } = await verifiedSession();
  if (
    ["administrator", "committee"].includes(session.role) &&
    !isStaff(session)
  )
    redirect("/sistema/mfa");
  if (!isStaff(session)) throw new Error("Se requiere personal con MFA.");
  const showDemonstrations = demonstrationsEnabled();
  const context = showDemonstrations
    ? null
    : await client.rpc("list_my_institutions");
  const parsedContext = institutionContextSchema.safeParse(context?.data);
  if (!showDemonstrations && (context?.error || !parsedContext.success))
    return (
      <section className="panel">
        <h1>Configuración institucional pendiente</h1>
        <p>
          Aplica las migraciones 007 y 008 para registrar instituciones y
          encargados. Las elecciones existentes se conservan.
        </p>
      </section>
    );
  const institutions = parsedContext.success
    ? parsedContext.data.institutions
    : [];
  return (
    <section className="panel">
      <WorkspaceHeading
        icon="preparation"
        eyebrow="UN NUEVO PROCESO ELECTORAL"
        title="Preparar elección"
      >
        Selecciona tu institución y el año electoral para comenzar a
        organizarla.
      </WorkspaceHeading>
      <p>
        Prepara el padrón y las candidaturas de la institución. La elección
        permanece en borrador hasta completar los requisitos y autorizar su
        apertura.
      </p>
      <ConnectedCreateElection
        showDemonstrations={demonstrationsEnabled()}
        institutions={institutions}
        expected={
          institutions[0]?.expected_students ??
          publicInstitution().expectedStudents
        }
        year={publicInstitution().initialYear}
      />
    </section>
  );
}
