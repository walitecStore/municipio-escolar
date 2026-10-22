import {
  WorkspaceHeading,
  WorkspaceMetric,
  WorkspaceNote,
} from "@/components/connected/workspace-ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifiedSession } from "@/lib/connected/session";
import { electionSchema, isStaff } from "@/lib/connected/policy";
import { integrationConfig } from "@/lib/connected/env";
import { demonstrationsEnabled } from "@/lib/platform";
export default async function Page() {
  const { client, session } = await verifiedSession();
  if (
    ["administrator", "committee"].includes(session.role) &&
    !isStaff(session)
  )
    redirect("/sistema/mfa");
  if (!isStaff(session)) throw new Error("Acceso restringido al personal.");
  const result = await client.rpc("list_accessible_elections");
  if (result.error) throw new Error("Estado institucional no disponible.");
  const elections = z
    .array(electionSchema)
    .parse(result.data)
    .filter((e) => demonstrationsEnabled() || e.purpose === "official");
  const config = integrationConfig();
  return (
    <section className="panel">
      <WorkspaceHeading
        icon="preparation"
        eyebrow="ANTES DE LA JORNADA ELECTORAL"
        title="Preparación institucional"
      >
        Consulta el estado real de la aplicación y organiza los pasos de tu
        elección.
      </WorkspaceHeading>
      <p>
        Revisa la preparación de las instituciones y elecciones autorizadas para
        tu cuenta. Cada elección conserva su padrón y su total de electores.
      </p>
      <div className="workspace-metrics">
        <WorkspaceMetric
          label="Elecciones institucionales"
          value={elections.filter((e) => e.purpose === "official").length}
        />
        <WorkspaceMetric
          label="En preparación"
          value={
            elections.filter(
              (e) => e.purpose === "official" && e.state === "draft",
            ).length
          }
          tone="purple"
        />
        <WorkspaceMetric
          label="Abiertas"
          value={
            elections.filter(
              (e) => e.purpose === "official" && e.state === "open",
            ).length
          }
          tone="green"
        />
      </div>
      <h2>Estado de esta aplicación</h2>
      <div className="readiness-list">
        {[
          {
            label: "Identidad del personal",
            detail: "Sesión protegida con verificación en dos pasos",
            ready: true,
          },
          {
            label: "Registro de votos",
            detail: config?.voting
              ? "Habilitado en la aplicación"
              : "Pendiente de habilitación por el responsable",
            ready: !!config?.voting,
          },
          {
            label: "Elecciones oficiales",
            detail: config?.official
              ? "Modo oficial habilitado en la aplicación"
              : "Modo oficial pendiente de habilitación",
            ready: !!config?.official,
          },
          {
            label: "Mesas con DNI",
            detail:
              process.env.ELECTORAL_SUPERVISED_DNI_ENABLED === "true"
                ? "Modalidad habilitada en la aplicación"
                : "Modalidad pendiente de habilitación",
            ready: process.env.ELECTORAL_SUPERVISED_DNI_ENABLED === "true",
          },
        ].map((item) => (
          <article
            className={`readiness-item ${item.ready ? "readiness-done" : ""}`}
            key={item.label}
          >
            <span className="readiness-indicator" aria-hidden="true">
              {item.ready ? "✓" : "!"}
            </span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
            <span className="state-pill">
              {item.ready ? "Configurado" : "Pendiente"}
            </span>
          </article>
        ))}
      </div>
      <WorkspaceNote title="Habilitar la aplicación no abre una elección">
        Cada elección también necesita su aprobación y su apertura. Si algún
        paso aparece pendiente, el administrador debe coordinarlo con el
        responsable de la plataforma.
      </WorkspaceNote>
      <h2>Preparación antes de abrir</h2>
      <ol className="preparation-steps">
        <li>
          Crear el borrador institucional y mantenerlo cerrado a la votación.
        </li>
        <li>
          Autorizar el tratamiento y la custodia del padrón y las fotografías.
        </li>
        <li>
          Importar y revisar el total de electores configurado y sus secciones.
        </li>
        <li>
          Completar listas, propuestas, candidatos y sus fotografías
          autorizadas.
        </li>
        <li>
          En modalidad presencial, habilitar equipos y verificar identidades; en
          modalidad individual, vincular cuentas y entregar credenciales.
        </li>
        <li>
          Verificar los accesos, la protección de datos, el voto único y el
          funcionamiento de las computadoras antes de la jornada.
        </li>
        <li>
          Registrar la aprobación institucional y de seguridad antes de
          habilitar y abrir la elección.
        </li>
      </ol>
      <p>
        El personal no puede aprobar su propia elección ni cambiar la aprobación
        mediante estos formularios. Apagar los interruptores de la aplicación no
        cierra una elección ya abierta en la base de datos.
      </p>
      <Link className="button primary" href="/sistema/nueva">
        Preparar elección
      </Link>
    </section>
  );
}
