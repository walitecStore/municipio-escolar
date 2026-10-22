import { WorkspaceHeading } from "@/components/connected/workspace-ui";
import { redirect } from "next/navigation";
import { MfaForm } from "@/components/connected/auth-forms";
import { verifiedSession } from "@/lib/connected/session";
export default async function Page() {
  const { session } = await verifiedSession();
  if (
    !["administrator", "committee"].includes(session.role) ||
    session.aal === "aal2"
  )
    redirect("/sistema");
  return (
    <section className="panel focused-form">
      <WorkspaceHeading
        icon="security"
        eyebrow="PROTEGE TU CUENTA"
        title="Verificación del comité"
      >
        Un paso más para mantener segura la información de tu institución.
      </WorkspaceHeading>
      <MfaForm />
    </section>
  );
}
