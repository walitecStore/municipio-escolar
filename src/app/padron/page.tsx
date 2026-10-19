import { Heading } from "@/components/ui";
import { ElectoralRoll } from "@/components/electoral-roll";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="COMUNIDAD ELECTORAL"
        title="Padrón electoral"
        description="230 estudiantes ficticios y 15 secciones. Importación y edición locales; no cargues información personal real."
      />
      <ElectoralRoll />
    </>
  );
}
