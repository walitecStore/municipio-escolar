import { isStaff } from "@/lib/connected/policy";
import { verifiedSession } from "@/lib/connected/session";
import { ConnectedCreateElection } from "@/components/connected/forms";
export default async function Page() {
  const { session } = await verifiedSession();
  if (!isStaff(session)) throw new Error("Se requiere personal con MFA.");
  return (
    <section className="panel">
      <h1>Crear elección de pruebas</h1>
      <p>No permite configurar una elección oficial ni aprobar su seguridad.</p>
      <ConnectedCreateElection />
    </section>
  );
}
