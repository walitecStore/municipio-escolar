import { Heading } from "@/components/ui";
import { DemoVote } from "@/components/demo-forms";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="SIMULACIÓN EDUCATIVA"
        title="Explora la pantalla de votación"
        description="Conoce el recorrido de selección. No es una elección activa ni un sistema de emisión de votos."
      />
      <DemoVote />
    </>
  );
}
