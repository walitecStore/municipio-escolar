import { integrationConfig } from "@/lib/connected/env";
import { cookies } from "next/headers";
import { Booth } from "@/components/connected/booth";
import { stationCookie } from "@/lib/connected/station";
export default async function Page() {
  if (
    !integrationConfig() ||
    process.env.ELECTORAL_SUPERVISED_DNI_ENABLED !== "true"
  )
    return (
      <section className="panel">
        <h1>Votación presencial deshabilitada</h1>
        <p>
          Preparar el padrón y los equipos no abre la elección. Consulta al
          comité.
        </p>
      </section>
    );
  return (
    <Booth configured={Boolean((await cookies()).get(stationCookie)?.value)} />
  );
}
