import { redirect } from "next/navigation";
import { verifiedSession } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
import { institutionContextSchema } from "@/lib/connected/institutions";
import { z } from "zod";
import { invitationsConfigured } from "@/lib/connected/auth-admin";
import { StaffInvitation } from "@/components/connected/staff-invitation";
import { InstitutionForm } from "@/components/connected/institution-form";
export default async function Page() {
  const { client, session, userId } = await verifiedSession();
  if (!isStaff(session)) redirect("/sistema/mfa");
  const response = await client.rpc("list_my_institutions");
  const parsed = institutionContextSchema.safeParse(response.data);
  if (response.error || !parsed.success)
    return (
      <section className="panel">
        <h1>Configuración institucional pendiente</h1>
        <p>
          La gestión de instituciones requiere las migraciones 007 y 008. No
          repitas las migraciones anteriores ni modifiques el padrón para
          configurar el acceso.
        </p>
      </section>
    );
  const data = parsed.data;
  const teams = new Map<
    string,
    {
      id: string;
      email: string;
      name: string;
      role: "administrator" | "committee";
      active: boolean;
      accepted: boolean;
    }[]
  >();
  if (session.role === "administrator") {
    for (const i of data.institutions) {
      const team = await client.rpc("get_institution_team", {
        p_institution: i.id,
      });
      const parsedTeam = z
        .array(
          z.object({
            id: z.string().uuid(),
            email: z.string(),
            name: z.string(),
            role: z.enum(["administrator", "committee"]),
            active: z.boolean(),
            accepted: z.boolean(),
          }),
        )
        .safeParse(team.data);
      if (!team.error && parsedTeam.success) teams.set(i.id, parsedTeam.data);
    }
  }
  return (
    <section className="panel">
      <h1>Mi institución y equipo</h1>
      <p>
        Cada institución administra únicamente sus elecciones y su padrón. Los
        cambios del perfil se aplican a nuevas elecciones; las actas y
        elecciones existentes conservan sus datos.
      </p>
      {data.institutions.map((i) => (
        <article className="panel section" key={i.id}>
          <h2>{i.name}</h2>
          <InstitutionForm
            operation="update"
            label="Guardar datos de la institución"
          >
            <input type="hidden" name="institution" value={i.id} />
            <label>
              Nombre institucional
              <input
                name="name"
                defaultValue={i.name}
                maxLength={160}
                required
              />
            </label>
            <label>
              Electores previstos para nuevas elecciones
              <input
                type="number"
                name="expected"
                defaultValue={i.expected_students}
                min={1}
                max={10000}
                required
              />
            </label>
          </InstitutionForm>
          {session.role === "administrator" && (
            <section className="section team-section">
              <h3>Tu equipo autorizado</h3>
              {teams.has(i.id) ? (
                <>
                  {invitationsConfigured() ? (
                    <StaffInvitation institution={i.id} />
                  ) : (
                    <p className="notice">
                      Las invitaciones aún no están configuradas. El responsable
                      técnico debe habilitar la configuración privada indicada
                      en la guía de personal.
                    </p>
                  )}
                  <div className="team-members">
                    {teams.get(i.id)!.map((member) => (
                      <article className="team-member" key={member.id}>
                        <div>
                          <strong>{member.name}</strong>
                          <p>{member.email}</p>
                          <span className="state-pill">
                            {member.role === "committee"
                              ? "Comité electoral"
                              : "Administrador"}{" "}
                            ·{" "}
                            {!member.active
                              ? "Acceso revocado"
                              : member.accepted
                                ? "Cuenta activada"
                                : "Invitación pendiente"}
                          </span>
                        </div>
                        {!member.accepted &&
                          member.active &&
                          invitationsConfigured() && (
                            <StaffInvitation
                              institution={i.id}
                              pending={member}
                            />
                          )}
                        {member.id !== userId && (
                          <InstitutionForm
                            operation="staff"
                            label={
                              member.active
                                ? "Revocar acceso"
                                : "Restablecer acceso"
                            }
                          >
                            <input
                              type="hidden"
                              name="institution"
                              value={i.id}
                            />
                            <input
                              type="hidden"
                              name="user"
                              value={member.id}
                            />
                            <input
                              type="hidden"
                              name="role"
                              value={member.role}
                            />
                            <input
                              type="hidden"
                              name="active"
                              value={member.active ? "no" : "yes"}
                            />
                            <label>
                              <input
                                type="checkbox"
                                name="confirmTeam"
                                required
                              />
                              Confirmo el cambio de acceso de esta persona.
                            </label>
                          </InstitutionForm>
                        )}
                      </article>
                    ))}
                  </div>
                  {!teams.get(i.id)!.length && (
                    <p>
                      Tu equipo todavía no tiene personal asignado. Crea su
                      primera invitación.
                    </p>
                  )}
                </>
              ) : (
                <p className="notice">
                  La gestión simplificada del equipo requiere aplicar la
                  migración 009. Los accesos existentes se conservan.
                </p>
              )}
            </section>
          )}
          {session.role === "administrator" && (
            <details>
              <summary>Asignar cuenta existente · opciones avanzadas</summary>
              <p>
                Usa el correo de una persona que ya tiene cuenta. Cada cuenta
                institucional pertenece a un solo colegio. No se reemplazan
                contraseñas ni se traslada personal de otra institución.
              </p>
              <InstitutionForm
                operation="existing"
                label="Asignar acceso a esta cuenta"
              >
                <input type="hidden" name="institution" value={i.id} />
                <label>
                  Correo de la cuenta existente
                  <input name="email" type="email" maxLength={254} required />
                </label>
                <label>
                  Rol
                  <select name="role">
                    <option value="committee">Comité electoral</option>
                    <option value="administrator">
                      Administrador institucional
                    </option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="active"
                    value="yes"
                    defaultChecked
                  />
                  Acceso activo (desmarca para revocar)
                </label>
              </InstitutionForm>
            </details>
          )}
        </article>
      ))}
      {data.platform_operator && (
        <article className="panel section">
          <h2>Registrar otra institución</h2>
          <p>
            Solo el operador de la plataforma puede incorporar instituciones.
            Primero crea la cuenta del encargado desde Supabase Auth; después
            asigna aquí su UUID. El encargado iniciará sesión, verificará MFA y
            completará los datos de su colegio.
          </p>
          <InstitutionForm
            operation="provision"
            label="Registrar institución y encargado"
          >
            <label>
              Nombre de la institución
              <input name="name" maxLength={160} required />
            </label>
            <label>
              UUID Auth del encargado
              <input name="user" required />
            </label>
            <label>
              Electores previstos
              <input
                type="number"
                name="expected"
                defaultValue={230}
                min={1}
                max={10000}
                required
              />
            </label>
          </InstitutionForm>
        </article>
      )}
    </section>
  );
}
