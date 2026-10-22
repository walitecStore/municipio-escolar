"use client";
import { WorkspaceHeading } from "@/components/connected/workspace-ui";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <WorkspaceHeading
        icon="security"
        eyebrow="TE AYUDAMOS A CONTINUAR"
        title="Acceso electoral no disponible"
      >
        Revisa tu sesión y vuelve a intentarlo.
      </WorkspaceHeading>
      <p>
        Si tu sesión terminó, inicia sesión nuevamente. Si el problema continúa,
        consulta al administrador de tu institución.
      </p>
      <div className="roll-actions">
        <Link className="button primary" href="/sistema/login">
          Iniciar sesión
        </Link>
        <button className="button secondary" onClick={reset}>
          Reintentar consulta
        </button>
      </div>
    </section>
  );
}
