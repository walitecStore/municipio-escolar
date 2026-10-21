import { redirect } from "next/navigation";
import { verifiedSession } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
import { institutionContextSchema } from "@/lib/connected/institutions";
import { InstitutionForm } from "@/components/connected/institution-form";
export default async function Page() {
  const { client, session } = await verifiedSession();
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
          <details>
            <summary>Asignar o revocar personal autorizado</summary>
            <p>
              La cuenta debe existir en Supabase Auth. Su identificador no es
              una contraseña. Cada cuenta institucional pertenece a un solo
              colegio; el registro público está deshabilitado.
            </p>
            <InstitutionForm
              operation="staff"
              label="Guardar acceso del personal"
            >
              <input type="hidden" name="institution" value={i.id} />
              <label>
                UUID de la cuenta autorizada
                <input name="user" required />
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
