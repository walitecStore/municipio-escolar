import { Heading } from "@/components/ui";
import { ElectoralResults } from "@/components/electoral-results";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="TRANSPARENCIA Y PARTICIPACIÓN"
        title="Resultados electorales"
        description="Recuento y exportaciones de demostración. El backend SQL protege el recuento real hasta el cierre oficial."
      />
      <ElectoralResults />
    </>
  );
}
