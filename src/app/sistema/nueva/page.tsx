import { redirect } from "next/navigation";
import { isStaff } from "@/lib/connected/policy";
import { verifiedSession } from "@/lib/connected/session";
import { ConnectedCreateElection } from "@/components/connected/forms";
export default async function Page() {
  const { session } = await verifiedSession();
  if (
    ["administrator", "committee"].includes(session.role) &&
    !isStaff(session)
  )
    redirect("/sistema/mfa");
  if (!isStaff(session)) throw new Error("Se requiere personal con MFA.");
  return (
    <section className="panel">
      <h1>Preparar elección</h1>
      <p>
        Elige un borrador institucional o una prueba. La modalidad institucional
        permite preparar el padrón y las candidaturas; no aprueba su seguridad
        ni abre la votación.
      </p>
      <ConnectedCreateElection />
    </section>
  );
}
