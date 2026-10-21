import { LockKeyhole, ChartNoAxesCombined } from "lucide-react";
import { closedElectionReport } from "@/lib/connected/report";
import { ConnectedResults } from "@/components/connected/results";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const report = await closedElectionReport((await params).election);
  if (!report.results)
    return (
      <section className="panel locked-state">
        <span className="locked-icon">
          <LockKeyhole size={33} aria-hidden="true" />
        </span>
        <h1>Resultados bloqueados</h1>
        <p>
          El recuento estará disponible después del cierre de la elección. La
          base de datos también protege esta información para todos los roles de
          la aplicación.
        </p>
        <span className="state-pill state-draft">Disponible al cierre</span>
      </section>
    );
  return (
    <section className="panel">
      <div className="report-heading">
        <span className="fact-icon amber">
          <ChartNoAxesCombined aria-hidden="true" />
        </span>
        <div>
          <h1>Resultados electorales</h1>
          <p>
            Elección cerrada · {report.election.school} · {report.election.year}
          </p>
        </div>
      </div>
      <ConnectedResults
        results={report.results}
        school={report.election.school}
        year={report.election.year}
        mayors={report.mayors}
        purpose={report.election.purpose}
        mode="charts"
      />
    </section>
  );
}
