import { redirect } from "next/navigation";
import { WorkspaceHeading } from "@/components/connected/workspace-ui";
import { PasswordForm } from "@/components/connected/password-forms";
import { verifiedSession } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
export default async function Page() {
  const { session } = await verifiedSession();
  if (
    ["administrator", "committee"].includes(session.role) &&
    !isStaff(session)
  )
    redirect("/sistema/mfa");
  if (!isStaff(session))
    throw new Error("Acceso restringido al personal autorizado.");
  return (
    <>
      <WorkspaceHeading
        icon="security"
        eyebrow="TU PERFIL Y SEGURIDAD"
        title="Cambiar contraseña"
      >
        Confirma tu contraseña actual y el código de tu autenticador. Después de
        guardar, inicia sesión con tu nueva contraseña.
      </WorkspaceHeading>
      <section className="panel focused-form">
        <PasswordForm />
      </section>
    </>
  );
}
