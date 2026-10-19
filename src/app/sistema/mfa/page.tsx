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
    <section className="panel">
      <h1>Verificación del comité</h1>
      <MfaForm />
    </section>
  );
}
