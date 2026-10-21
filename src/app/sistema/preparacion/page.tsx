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
      <h1>Preparación institucional</h1>
      <p>
        Revisa la preparación de las instituciones y elecciones autorizadas para
        tu cuenta. Cada elección conserva su padrón y su total de electores.
      </p>
      <h2>Estado de esta aplicación</h2>
      <ul>
        <li>Personal autenticado con MFA.</li>
        <li>
          Emisión desde la aplicación:{" "}
          {config?.voting ? "habilitada" : "deshabilitada"}.
        </li>
        <li>
          Modo oficial en la aplicación:{" "}
          {config?.official ? "habilitado" : "deshabilitado"}.
        </li>
        <li>
          Borradores institucionales:{" "}
          {
            elections.filter(
              (e) => e.purpose === "official" && e.state === "draft",
            ).length
          }
          .
        </li>
        <li>
          Elecciones oficiales abiertas en la base de datos:{" "}
          {
            elections.filter(
              (e) => e.purpose === "official" && e.state === "open",
            ).length
          }
          .
        </li>
      </ul>
      <p>
        Estos estados describen la configuración y los registros consultados; no
        son una certificación de seguridad.
      </p>
      <h2>Preparación antes de abrir</h2>
      <ol>
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
          Validar Auth, MFA, RLS, concurrencia, doble voto y resultados
          protegidos en el proyecto alojado.
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
