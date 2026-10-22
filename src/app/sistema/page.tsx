import Link from "next/link";
import { demonstrationsEnabled } from "@/lib/platform";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ShieldCheck,
  ArrowRight,
  CalendarDays,
  LogOut,
  School,
} from "lucide-react";
import { Heading } from "@/components/ui";
import { ModuleCard } from "@/components/module-card";
import { integrationConfig } from "@/lib/connected/env";
import { verifiedSession } from "@/lib/connected/session";
import { electionSchema, isStaff } from "@/lib/connected/policy";
import { logoutAction } from "./auth-actions";
export default async function Page() {
  if (!integrationConfig())
    return (
      <>
        <Heading
          eyebrow="CONFIGURACIÓN INSTITUCIONAL"
          title="Integración pendiente de configuración"
          description="Configura la conexión institucional para acceder a la gestión electoral."
        />
        <section className="panel">
          <p>
            Sigue docs/ACTIVACION-SUPABASE.md para preparar manualmente tu
            entorno institucional.
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
  const elections = z
    .array(electionSchema)
    .parse(response.data)
    .filter((e) => demonstrationsEnabled() || e.purpose === "official");
  return (
    <>
      <div className="dashboard-heading">
        <Heading
          eyebrow="TU ESPACIO ELECTORAL"
          title="Panel electoral"
          description={`Perfil autorizado: ${session.role === "administrator" ? "Administrador" : session.role === "committee" ? "Comité electoral" : "Elector"}. Acompaña cada etapa del proceso de tu comunidad.`}
        />
        <form action={logoutAction}>
          <button className="button secondary">
            <LogOut size={17} aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
      <section className="dashboard-welcome">
        <span className="welcome-bubble">
          <School size={36} aria-hidden="true" />
        </span>
        <div>
          <h2>¡Construyamos una mejor escuela!</h2>
          <p>
            Selecciona una elección para encontrar sus candidatos, padrón, mesas
            y documentos.
          </p>
        </div>
        <ShieldCheck className="welcome-check" size={44} aria-hidden="true" />
      </section>
      <section className="section">
        <div className="section-header">
          <div>
            <h2>Elecciones disponibles</h2>
            <p>Procesos autorizados para tu cuenta.</p>
          </div>
          <span className="count-pill">
            {elections.length}{" "}
            {elections.length === 1 ? "elección" : "elecciones"}
          </span>
        </div>
        <div className="election-list">
          {elections.map((e) => (
            <Link
              className="election-entry"
              href={`/sistema/${e.id}`}
              key={e.id}
            >
              <span className="election-entry-icon">
                <School size={26} aria-hidden="true" />
              </span>
              <span className="election-entry-copy">
                <strong>{e.school}</strong>
                <span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {e.year}
                  <span className={`state-pill state-${e.state}`}>
                    {e.state === "draft"
                      ? "Borrador"
                      : e.state === "open"
                        ? "Abierta"
                        : "Cerrada"}
                  </span>
                  {e.purpose === "test" ? "Pruebas" : "Institucional"}
                </span>
              </span>
              <ArrowRight size={21} aria-hidden="true" />
            </Link>
          ))}
          {!elections.length && (
            <div className="panel empty-election">
              <School size={36} aria-hidden="true" />
              <h3>Tu próxima elección empieza aquí</h3>
              <p>
                No hay elecciones asignadas. El personal autorizado puede
                preparar un borrador institucional.
              </p>
            </div>
          )}
        </div>
      </section>
      {isStaff(session) && (
        <section
          className="section"
          aria-label="Acciones rápidas de administración"
        >
          <div className="section-header">
            <div>
              <h2>Gestiona tu institución</h2>
              <p>Todo listo para organizarte con tu equipo.</p>
            </div>
          </div>
          <div className="module-grid management-grid">
            <ModuleCard
              module={{
                key: "institution",
                title: "Mi institución y equipo",
                description: "Configura tu colegio y el personal autorizado.",
                href: "/sistema/instituciones",
                icon: "school",
                tone: "blue",
              }}
            />
            <ModuleCard
              module={{
                key: "new",
                title: "Preparar elección",
                description: "Crea un proceso y organiza cada etapa.",
                href: "/sistema/nueva",
                icon: "plus",
                tone: "green",
              }}
            />
            <ModuleCard
              module={{
                key: "preparation",
                title: "Estado de preparación institucional",
                description:
                  "Revisa los requisitos antes de abrir tu elección.",
                href: "/sistema/preparacion",
                icon: "shield",
                tone: "purple",
              }}
            />
          </div>
        </section>
      )}
    </>
  );
}
