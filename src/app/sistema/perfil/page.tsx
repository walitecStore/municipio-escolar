import { redirect } from "next/navigation";
import { Heading } from "@/components/ui";
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
      <Heading
        eyebrow="PERFIL DEL PERSONAL"
        title="Cambiar contraseña"
        description="Confirma tu identidad con la contraseña actual y un código MFA reciente. Al guardar, deberás iniciar sesión nuevamente."
      />
      <section className="panel">
        <PasswordForm />
      </section>
    </>
  );
}
