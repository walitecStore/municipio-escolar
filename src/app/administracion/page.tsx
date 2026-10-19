import { ElectoralAdmin } from "@/components/electoral-admin";
import { CredentialDemo } from "@/components/credential-demo";
import { institution } from "@/lib/institution";
import Link from "next/link";
import { Users, Flag, CalendarDays, ArrowRight } from "lucide-react";
import { Heading } from "@/components/ui";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="VISTA ADMINISTRATIVA · DEMOSTRACIÓN"
        title="Organiza la participación"
        description="Panel público de muestra, sin funciones administrativas reales ni acceso a datos privados."
      />
      <div className="stats-grid">
        <div className="stat">
          <Users />
          <div>
            <strong>{institution.expectedStudents}</strong>
            <span>Estudiantes ficticios</span>
          </div>
        </div>
        <div className="stat">
          <Flag />
          <div>
            <strong>03</strong>
            <span>Listas de ejemplo</span>
          </div>
        </div>
        <div className="stat">
          <CalendarDays />
          <div>
            <strong>Borrador</strong>
            <span>Estado ilustrativo</span>
          </div>
        </div>
      </div>
      <div className="access-grid section">
        <section className="panel">
          <h2>Elección escolar {institution.initialYear}</h2>
          <p>
            {institution.name} · {institution.level}
          </p>
          <dl>
            <dt>Fecha de ejemplo</dt>
            <dd>20 de noviembre de 2026</dd>
            <dt>Nivel educativo</dt>
            <dd>Secundaria</dd>
            <dt>Modalidad</dt>
            <dd>Prototipo sin registro de votos</dd>
          </dl>
          <div className="notice">
            El padrón ficticio permite importar y corregir registros localmente.
            La autenticación y la migración de seguridad están pendientes de
            conexión y despliegue autorizado.
          </div>
        </section>
        <section className="panel">
          <h2>Explorar el proceso</h2>
          {[
            ["/padron", "Consultar padrón ficticio"],
            ["/candidatos", "Revisar listas y propuestas"],
            ["/resultados", "Ver resultados ilustrativos"],
          ].map(([url, label]) => (
            <Link className="admin-link" href={url} key={url}>
              {label}
              <ArrowRight size={18} />
            </Link>
          ))}
        </section>
      </div>
      <ElectoralAdmin />
      <CredentialDemo />
    </>
  );
}
