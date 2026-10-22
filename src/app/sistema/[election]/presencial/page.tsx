import {
  WorkspaceHeading,
  WorkspaceMetric,
  WorkspaceNote,
} from "@/components/connected/workspace-ui";
import Link from "next/link";
import { z } from "zod";
import { protectedElection } from "@/lib/connected/session";
import { StationControlForm } from "@/components/connected/station-control";
const controlSchema = z.object({
  stations: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      active: z.boolean(),
      expires_at: z.string(),
    }),
  ),
  turns: z.array(
    z.object({
      id: z.string().uuid(),
      station_id: z.string().uuid(),
      name: z.string(),
      dni: z.string(),
      grade: z.number(),
      section: z.string(),
      state: z.string(),
    }),
  ),
});
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election } = await protectedElection(id, true);
  const response = await client.rpc("get_supervised_control", {
    p_election: id,
  });
  const data = response.error ? null : controlSchema.parse(response.data);
  return (
    <section className="panel">
      <WorkspaceHeading
        icon="stations"
        eyebrow="EQUIPOS Y VERIFICACIÓN PRESENCIAL"
        title="Votación presencial con DNI"
      >
        Organiza las computadoras de votación y autoriza a cada estudiante
        después de comprobar su identidad.
      </WorkspaceHeading>
      <p>
        Carga primero un padrón con DNI de ocho dígitos. El comité verifica
        físicamente cada identidad; el estudiante no necesita cuenta ni
        contraseña. Preparar equipos no abre la elección.
      </p>
      {!data ? (
        <p>
          Aplica manualmente la migración 006 después de revisar su guía. La
          configuración existente permanece intacta.
        </p>
      ) : (
        <>
          <div className="workspace-metrics">
            <WorkspaceMetric
              label="Equipos registrados"
              value={data.stations.length}
            />
            <WorkspaceMetric
              label="Equipos habilitados"
              value={data.stations.filter((s) => s.active).length}
              tone="green"
            />
            <WorkspaceMetric
              label="Turnos en revisión"
              value={data.turns.filter((t) => t.state === "pending").length}
              tone="purple"
            />
          </div>
          {election.state === "draft" && !election.supervised_dni && (
            <StationControlForm id={id} operation="configure">
              <label>
                <input type="checkbox" name="confirm" value="yes" required />
                Confirmo la modalidad presencial supervisada. Todos los
                registros deben tener DNI válido.
              </label>
            </StationControlForm>
          )}
          {election.supervised_dni && (
            <StationControlForm id={id} operation="create">
              <label>
                Nombre del equipo
                <input
                  name="label"
                  placeholder="Mesa 1 · Computadora 1"
                  maxLength={40}
                  required
                />
              </label>
            </StationControlForm>
          )}
          <p>
            En cada equipo usa un navegador sin sesión de administrador y abre{" "}
            <Link href="/sistema/mesa">/sistema/mesa</Link>. Introduce su
            habilitación privada una vez. Nunca dejes el panel administrativo en
            un equipo de estudiantes.
          </p>
          <h2>Equipos de votación</h2>
          {!data.stations.length && (
            <div className="directory-empty">
              <strong>Prepara tu primera computadora</strong>
              <p>
                Escribe un nombre fácil de reconocer y crea su habilitación en
                el formulario de arriba.
              </p>
            </div>
          )}
          {data.stations.map((s) => (
            <article className="station-card" key={s.id}>
              <p>
                {s.label} · {s.active ? "Habilitación emitida" : "Revocado"} ·
                Caduca:{" "}
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Lima",
                }).format(new Date(s.expires_at))}
              </p>
              {s.active && (
                <StationControlForm id={id} operation="revoke">
                  <input type="hidden" name="station" value={s.id} />
                </StationControlForm>
              )}
            </article>
          ))}
          <h2>Verificación presencial de alumnos</h2>
          <Link className="button secondary" href={`/sistema/${id}/presencial`}>
            Actualizar turnos
          </Link>
          {!data.turns.length && (
            <WorkspaceNote title="Sin turnos en espera">
              Cuando un estudiante ingrese su DNI en una computadora habilitada,
              su solicitud aparecerá aquí. Pulsa Actualizar turnos para
              consultar los nuevos ingresos.
            </WorkspaceNote>
          )}
          {data.turns.map((t) => (
            <article className="panel" key={t.id}>
              <h3>{t.name}</h3>
              <p>
                DNI: {t.dni} · {t.grade}.º {t.section} ·{" "}
                {data.stations.find((s) => s.id === t.station_id)?.label} ·{" "}
                <span className="state-pill">
                  {t.state === "pending"
                    ? "Por verificar"
                    : t.state === "authorized"
                      ? "Autorizado para votar"
                      : t.state === "consumed"
                        ? "Participación registrada"
                        : "En revisión"}
                </span>
              </p>
              <StationControlForm id={id} operation="approve">
                <input type="hidden" name="station" value={t.station_id} />
                <input type="hidden" name="turn" value={t.id} />
                <label>
                  <input type="checkbox" name="confirm" value="yes" required />
                  He comprobado presencialmente el documento y la identidad del
                  alumno en esta computadora.
                </label>
              </StationControlForm>
              <StationControlForm id={id} operation="cancel">
                <input type="hidden" name="station" value={t.station_id} />
                <input type="hidden" name="turn" value={t.id} />
              </StationControlForm>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
