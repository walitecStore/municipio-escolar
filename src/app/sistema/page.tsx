import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ClipboardList, ShieldCheck, KeyRound, ArrowRight, AlertCircle } from "lucide-react";
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
      {isStaff(session) && (
        <Link className="button secondary" href="/sistema/perfil">
          Perfil · Cambiar contraseña
        </Link>
      )}
      <form action={logoutAction}>
        <button className="button secondary">Cerrar sesión</button>
      </form>
      <section className="panel section" aria-label="Estado de seguridad electoral">
        <h2><ShieldCheck size={20} aria-hidden="true" /> Entorno electoral protegido</h2>
        <p><AlertCircle size={16} aria-hidden="true" /> La votación oficial continúa deshabilitada. Utiliza identidades ficticias para las pruebas y no cargues todavía el padrón real.</p>
      </section>
      {isStaff(session) && (
        <section className="section" aria-label="Acciones rápidas de administración">
          <div className="section-header"><div><h2>¿Qué deseas hacer?</h2><p>Accesos directos a las tareas más importantes del administrador.</p></div></div>
          <div className="quick-actions-grid">
            <Link href="/sistema/nueva" className="quick-action-card"><ClipboardList size={26} aria-hidden="true" /><strong>Crear elección de prueba</strong><span>Prepara una elección sin activar votos oficiales.</span><ArrowRight size={18} aria-hidden="true" /></Link>
            <Link href="/sistema/perfil" className="quick-action-card"><KeyRound size={26} aria-hidden="true" /><strong>Seguridad y contraseña</strong><span>Revisa tu perfil y cambia la contraseña de acceso.</span><ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </section>
      )}
      <section className="panel section">
        <h2>Elecciones disponibles</h2>
        {elections.map((e) => (
          <div className="admin-link" key={e.id}>
            <Link href={`/sistema/${e.id}`}>
              {e.school} · {e.year} · {e.state} ·{" "}
              {e.purpose === "test" ? "Pruebas" : "Oficial"} <ArrowRight size={16} aria-hidden="true" />
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
