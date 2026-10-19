"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>Acceso electoral no disponible</h1>
      <p>
        La sesión, autorización o configuración no permite completar esta
        operación. No se muestran detalles internos ni datos sensibles.
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
