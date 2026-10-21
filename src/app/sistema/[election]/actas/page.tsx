import { LockKeyhole, FileText } from "lucide-react";
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
        <span className="locked-icon purple">
          <LockKeyhole size={33} aria-hidden="true" />
        </span>
        <h1>Actas disponibles después del cierre</h1>
        <p>
          Primero debe cerrarse la elección. Después podrás preparar el acta con
          el recuento definitivo, la insignia institucional y los espacios para
          las firmas.
        </p>
        <span className="state-pill state-draft">Sin documentos emitidos</span>
      </section>
    );
  return (
    <section className="panel">
      <div className="report-heading">
        <span className="fact-icon purple">
          <FileText aria-hidden="true" />
        </span>
        <div>
          <h1>Actas y documentos</h1>
          <p>
            {report.election.school} · {report.election.year} · Elección cerrada
          </p>
        </div>
      </div>
      {report.election.purpose === "test" && (
        <p className="notice">PRUEBAS: sin validez oficial</p>
      )}
      <p>
        Completa los datos institucionales para generar el documento de revisión
        y firma. También puedes descargar el recuento agregado en Excel.
      </p>
      <ConnectedResults
        results={report.results}
        school={report.election.school}
        year={report.election.year}
        mayors={report.mayors}
        purpose={report.election.purpose}
        mode="documents"
      />
    </section>
  );
}
