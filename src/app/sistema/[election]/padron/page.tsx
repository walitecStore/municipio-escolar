import Link from "next/link";
import {
  WorkspaceHeading,
  WorkspaceMetric,
} from "@/components/connected/workspace-ui";
import {
  RollDirectory,
  RollTemplate,
} from "@/components/connected/roll-directory";
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
      <WorkspaceHeading
        icon="roll"
        eyebrow="ESTUDIANTES DE TU INSTITUCIÓN"
        title={`Padrón electoral · ${election.year}`}
        action={
          <div className="heading-actions">
            <Link className="button secondary" href="#registros-padron">
              Ver estudiantes
            </Link>
            <Link className="button primary" href="#importar-padron">
              Importar estudiantes
            </Link>
          </div>
        }
      >
        Organiza el padrón por grado y sección. Busca a cada estudiante por su
        nombre o DNI.
      </WorkspaceHeading>
      <div className="workspace-metrics">
        <WorkspaceMetric
          label="Estudiantes registrados"
          value={students.length}
        />
        <WorkspaceMetric
          label="Participaciones registradas"
          value={counts.reduce((n, c) => n + c.voters, 0)}
          tone="green"
        />
        <WorkspaceMetric
          label="Por participar"
          value={counts.reduce((n, c) => n + c.pending, 0)}
          tone="purple"
        />
      </div>
      <section className="panel">
        <h2>Resumen por grado y sección</h2>
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
      <section className="panel section" id="importar-padron">
        <span className="step-badge">CARGA DE ESTUDIANTES</span>
        <h2>Importar padrón desde Excel</h2>
        <RollTemplate official={election.purpose === "official"} />
        <ConnectedImportRoll election={election} />
      </section>
      <section className="panel section">
        <h2>Corregir registros del padrón</h2>
        <p>
          {election.supervised_dni
            ? "Modalidad presencial: el alumno se identifica con DNI y el comité lo verifica. No necesita correo ni contraseña."
            : "Modalidad individual: cada cuenta debe existir previamente en Auth. No se crean usuarios ni se usan claves administrativas desde esta página."}
        </p>
        <ConnectedCorrectStudent election={election} students={students} />
      </section>
      <section className="panel section" id="registros-padron">
        <h2>Registros autorizados</h2>
        <RollDirectory
          students={students}
          supervised={election.supervised_dni}
        />
      </section>
    </>
  );
}
