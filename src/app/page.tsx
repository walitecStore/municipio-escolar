import Link from "next/link";
import { InstallApp } from "@/components/install-app";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  GraduationCap,
  CalendarDays,
} from "lucide-react";

import { publicInstitution, demonstrationsEnabled } from "@/lib/platform";
export default function Home() {
  const institution = publicInstitution();
  return (
    <>
      <div className="home-intro">
        <div>
          <div className="eyebrow">COMUNIDADES EDUCATIVAS · PERÚ</div>
          <h1>Elecciones del Municipio Escolar</h1>
          <p>{institution.name}</p>
        </div>
        <div className="year-pill">
          <CalendarDays size={18} /> Año inicial {institution.initialYear}
        </div>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-tag">
            <span /> PARTICIPACIÓN DEMOCRÁTICA
          </div>
          <h2>
            Tu escuela.
            <br />
            Tu voz.
            <br />
            <span>Tu participación.</span>
          </h2>
          <p>
            Gestiona el proceso electoral desde tu cuenta autorizada. El comité
            prepara el padrón y las candidaturas antes de abrir la elección.
          </p>
          <div className="hero-actions">
            <Link href="/sistema" className="button white">
              Ingresar al sistema <ArrowRight size={18} />
            </Link>
            <Link href="/sistema/login" className="hero-link">
              Acceso del comité electoral
            </Link>
          </div>
        </div>
        <div className="hero-art institutional-art" aria-hidden="true">
          <ShieldCheck size={140} strokeWidth={1.2} />
          <strong>Participación con confianza</strong>
        </div>
      </section>
      <section
        className="quick-actions-grid section"
        aria-label="Datos institucionales"
      >
        <article className="panel">
          <Users size={25} />
          <h2>Instituciones independientes</h2>
          <p>
            Cada encargado accede únicamente al padrón y las elecciones de su
            institución.
          </p>
        </article>
        <article className="panel">
          <GraduationCap size={25} />
          <h2>Gestión institucional</h2>
          <p>
            Datos del colegio, personal autorizado, padrón, candidaturas y
            actas.
          </p>
        </article>
        <article className="panel">
          <ShieldCheck size={25} />
          <h2>Acceso protegido</h2>
          <p>
            El personal verifica su identidad con contraseña y autenticador.
          </p>
        </article>
      </section>
      <section className="panel section">
        <h2>Tu plataforma, también como aplicación</h2>
        <p>
          Instálala en tu celular o computadora. La verificación del comité y el
          registro centralizado requieren conexión a internet.
        </p>
        <InstallApp />
      </section>
      {demonstrationsEnabled() && (
        <p className="section">
          <Link className="text-link" href="/demostracion">
            Consultar el recorrido de demostración con datos ficticios
          </Link>
        </p>
      )}
    </>
  );
}
