import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Heading } from "@/components/ui";
import { integrationConfig } from "@/lib/connected/env";
import { verifiedSession } from "@/lib/connected/session";
import { electionSchema, isStaff } from "@/lib/connected/policy";
import { logoutAction } from "./auth-actions";
export default async function Page() {
  if (!integrationConfig())
    return (
      <>
        <Heading
          eyebrow="SUPABASE"
          title="Integración pendiente de configuración"
          description="La demostración continúa disponible. No se ha conectado una base de datos ni habilitado votación oficial."
        />
        <section className="panel">
          <p>
            Sigue docs/ACTIVACION-SUPABASE.md para preparar manualmente tu
            entorno de pruebas.
          </p>
          <Link className="button primary" href="/sistema/login">
            Ver acceso seguro
          </Link>
        </section>
      </>
    );
  const { client, session } = await verifiedSession();
  if (
    ["administrator", "committee"].includes(session.role) &&
    !isStaff(session)
  )
    redirect("/sistema/mfa");
  const response = await client.rpc("list_accessible_elections");
  if (response.error) throw new Error("Consulta de elecciones no disponible.");
  const elections = z.array(electionSchema).parse(response.data);
  return (
    <>
      <Heading
        eyebrow="SESIÓN VERIFICADA"
        title="Panel electoral conectado"
        description={`Perfil autorizado: ${session.role === "administrator" ? "Administrador" : session.role === "committee" ? "Comité electoral" : "Elector"}. Los permisos se verifican también en PostgreSQL.`}
      />
      <form action={logoutAction}>
        <button className="button secondary">Cerrar sesión</button>
      </form>
      <section className="panel section">
        <h2>Elecciones disponibles</h2>
        {elections.map((e) => (
          <div className="admin-link" key={e.id}>
            <Link href={`/sistema/${e.id}`}>
              {e.school} · {e.year} · {e.state} ·{" "}
              {e.purpose === "test" ? "Pruebas" : "Oficial"}
            </Link>
          </div>
        ))}
        {!elections.length && (
          <p>
            No hay elecciones asignadas. El personal autorizado puede crear un
            borrador de pruebas.
          </p>
        )}
        {isStaff(session) && (
          <Link className="button primary" href="/sistema/nueva">
            Crear elección de pruebas
          </Link>
        )}
      </section>
    </>
  );
}
