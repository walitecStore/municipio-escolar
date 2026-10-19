import { Heading } from "@/components/ui";
import { lists } from "@/lib/demo";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="TRANSPARENCIA Y PARTICIPACIÓN"
        title="Resultados electorales"
        description="Ejemplo visual con cifras estáticas inventadas. No representan votos emitidos ni resultados oficiales."
      />
      <div className="notice">
        Los datos de esta pantalla son independientes de la demostración de
        votación.
      </div>
      <section className="panel results-panel">
        <div className="section-header">
          <div>
            <h2>Distribución ilustrativa</h2>
            <p>210 preferencias ficticias · 230 estudiantes de ejemplo</p>
          </div>
          <span className="badge">Datos de demostración</span>
        </div>
        {lists.map((l) => (
          <div className="result-row" key={l.id}>
            <div className="result-label">
              <div>
                <span className="small-label">LISTA {l.id}</span>
                <h3>{l.name}</h3>
              </div>
              <div>
                <strong>{((l.votes / 210) * 100).toFixed(1)} %</strong>
                <span>{l.votes} preferencias ficticias</span>
              </div>
            </div>
            <div
              className="result-track"
              role="meter"
              aria-label={l.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(((l.votes / 210) * 100).toFixed(1))}
            >
              <div
                style={{
                  width: `${(l.votes / 210) * 100}%`,
                  background: l.color,
                }}
              />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
