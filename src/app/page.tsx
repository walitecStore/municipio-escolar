import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import { institution, classrooms } from "@/lib/institution";
export default function Home() {
  return (
    <>
      <div className="home-intro">
        <div>
          <div className="eyebrow">COMUNIDAD EDUCATIVA · SECUNDARIA</div>
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
              Acceso de estudiantes y personal
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
          <h2>{institution.expectedStudents} estudiantes previstos</h2>
          <p>
            La cantidad de electores habilitados se consulta en el padrón
            autorizado.
          </p>
        </article>
        <article className="panel">
          <GraduationCap size={25} />
          <h2>15 secciones de secundaria</h2>
          <p>Grados de 1.º a 5.º, secciones A, B y C.</p>
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
        <h2>Grados y secciones</h2>
        <div className="roll-actions">
          {classrooms.map((c) => (
            <span className="year-pill" key={c.label}>
              {c.label}
            </span>
          ))}
        </div>
        <p>
          La apertura electoral y la publicación de resultados corresponden al
          comité autorizado.
        </p>
      </section>
      <p className="section">
        <Link className="text-link" href="/demostracion">
          Consultar el recorrido de demostración con datos ficticios
        </Link>
      </p>
    </>
  );
}
