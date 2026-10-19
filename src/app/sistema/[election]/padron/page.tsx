import { protectedElection } from "@/lib/connected/session";
import { rollSchema, summarySchema } from "@/lib/connected/data";
import {
  ConnectedImportRoll,
  ConnectedCorrectStudent,
} from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { client, election } = await protectedElection(id, true);
  const [roll, summary] = await Promise.all([
    client.rpc("get_electoral_roll", { p_election: id }),
    client.rpc("electoral_roll_summary", { p_election: id }),
  ]);
  if (roll.error || summary.error)
    throw new Error("Consulta del padrón no disponible.");
  const students = rollSchema.parse(roll.data);
  const counts = summarySchema.parse(summary.data);
  return (
    <>
      <h1>Padrón conectado · {election.year}</h1>
      <section className="panel">
        <h2>Conteos de PostgreSQL</h2>
        <p>
          {counts.reduce((n, c) => n + c.electors, 0)} electores ·{" "}
          {counts.reduce((n, c) => n + c.voters, 0)} votantes ·{" "}
          {counts.reduce((n, c) => n + c.pending, 0)} pendientes
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Grado</th>
                <th>Sección</th>
                <th>Electores</th>
                <th>Votantes</th>
                <th>Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={`${c.grade}${c.section}`}>
                  <td>{c.grade}.º</td>
                  <td>{c.section}</td>
                  <td>{c.electors}</td>
                  <td>{c.voters}</td>
                  <td>{c.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel section">
        <h2>Importación transaccional</h2>
        <ConnectedImportRoll election={election} />
      </section>
      <section className="panel section">
        <h2>Corregir y vincular cuentas Auth</h2>
        <p>
          Cada cuenta debe existir previamente en Auth. No se crean usuarios ni
          se usan claves administrativas desde esta página.
        </p>
        <ConnectedCorrectStudent election={election} students={students} />
      </section>
      <section className="panel section">
        <h2>Registros autorizados</h2>
        <div className="table-scroll">
          <table aria-label="Padrón conectado">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Grado</th>
                <th>Sección</th>
                <th>Cuenta vinculada</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.code}</td>
                  <td>{s.full_name}</td>
                  <td>{s.grade}</td>
                  <td>{s.section}</td>
                  <td>{s.auth_user_id ? "Sí" : "Pendiente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
