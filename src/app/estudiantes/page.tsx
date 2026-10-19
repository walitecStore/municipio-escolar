import { Heading } from "@/components/ui";
import { StudentAccess } from "@/components/demo-forms";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="ESPACIO DEL ESTUDIANTE"
        title="Tu participación empieza aquí"
        description="Vista de acceso ilustrativa. No ingreses información personal real."
      />
      <StudentAccess />
    </>
  );
}
