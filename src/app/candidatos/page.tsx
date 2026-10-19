import { Heading, CandidateCards } from "@/components/ui";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="CONOCE SUS PROPUESTAS"
        title="Listas y candidatos"
        description="Descubre tres equipos ficticios y sus ideas para nuestra escuela. Fotografías de referencia; no representan estudiantes reales del proyecto."
      />
      <CandidateCards />
    </>
  );
}
