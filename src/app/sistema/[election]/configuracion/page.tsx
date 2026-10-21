import { protectedElection } from "@/lib/connected/session";
import { InstitutionalSettings } from "@/components/connected/institutional-settings";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const { election } = await protectedElection((await params).election, true);
  return (
    <section className="panel">
      <h1>Configuración institucional</h1>
      <p>
        Estos datos se usan en el padrón, las condiciones de apertura y el acta
        electoral. El total debe corresponder al padrón definitivo; no lo
        reduzcas para omitir estudiantes pendientes de carga.
      </p>
      <InstitutionalSettings election={election} />
      <p>
        La identidad visual de la portada se configura por despliegue. La
        insignia y los nombres de los firmantes se incorporan al descargar el
        acta desde Resultados después del cierre.
      </p>
    </section>
  );
}
