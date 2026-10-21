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
      <h1>Votación presencial con DNI</h1>
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
          <h2>Equipos</h2>
          {data.stations.map((s) => (
            <div key={s.id}>
              <p>
                {s.label} · {s.active ? "Habilitación emitida" : "Revocado"} ·
                Caduca: {s.expires_at}
              </p>
              {s.active && (
                <StationControlForm id={id} operation="revoke">
                  <input type="hidden" name="station" value={s.id} />
                </StationControlForm>
              )}
            </div>
          ))}
          <h2>Verificación presencial de alumnos</h2>
          <Link className="button secondary" href={`/sistema/${id}/presencial`}>
            Actualizar turnos
          </Link>
          {data.turns.map((t) => (
            <article className="panel" key={t.id}>
              <h3>{t.name}</h3>
              <p>
                DNI: {t.dni} · {t.grade}.º {t.section} ·{" "}
                {data.stations.find((s) => s.id === t.station_id)?.label} ·{" "}
                {t.state}
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
