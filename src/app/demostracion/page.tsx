import { institution } from "@/lib/institution";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Users,
  Flag,
  ShieldCheck,
  Check,
  Vote,
  Sparkles,
} from "lucide-react";
import { CandidateCards } from "@/components/ui";
export default function Home() {
  return (
    <>
      <div className="home-intro">
        <div>
          <div className="eyebrow">PARTICIPACIÓN QUE TRANSFORMA</div>
          <h1>
            Tu escuela. Tu voz. <span>Tu elección.</span>
          </h1>
          <p>Construyamos juntos la escuela que queremos.</p>
        </div>
        <div className="year-pill">
          <span className="green-dot" /> Proceso electoral{" "}
          {institution.initialYear}
        </div>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-tag">
            <span /> ELECCIONES DEL MUNICIPIO ESCOLAR
          </div>
          <h2>
            Las grandes ideas
            <br />
            empiezan con
            <br />
            <span>tu participación.</span>
          </h2>
          <p>
            Conoce a tus candidatos, descubre sus propuestas
            <br className="desktop-break" /> y sé parte del futuro de nuestra
            comunidad.
          </p>
          <div className="hero-actions">
            <Link href="/candidatos" className="button white">
              Conocer las listas <ArrowRight size={17} />
            </Link>
            <Link href="/votacion" className="hero-link">
              Explorar la votación <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="hero-school">
            <Graduation /> {institution.name} <span>·</span> Perú
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="spark spark-one">✳</div>
          <div className="spark spark-two">+</div>
          <div className="ballot-paper">
            <div className="paper-line" />
            <div className="paper-line short" />
            <div className="paper-check">
              <Check size={36} />
            </div>
          </div>
          <div className="ballot-box">
            <div className="ballot-slot" />
            <div className="ballot-symbol">
              <Vote size={53} strokeWidth={1.5} />
            </div>
            <span>MI VOZ CUENTA</span>
          </div>
          <div className="art-sticker">
            <ShieldCheck size={19} /> Participación con propósito
          </div>
        </div>
      </section>
      <section className="stats-grid" aria-label="Resumen de demostración">
        <div className="stat">
          <span className="stat-icon blue">
            <Users size={23} />
          </span>
          <div>
            <strong>{institution.expectedStudents}</strong>
            <span>Estudiantes en el padrón</span>
          </div>
          <span className="stat-note">Demo</span>
        </div>
        <div className="stat">
          <span className="stat-icon green">
            <Flag size={23} />
          </span>
          <div>
            <strong>03</strong>
            <span>Listas participantes</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon amber">
            <CalendarDays size={23} />
          </span>
          <div>
            <strong>20 nov.</strong>
            <span>Fecha ilustrativa · 2026</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-header">
          <div>
            <div className="eyebrow">IDEAS PARA UNA MEJOR ESCUELA</div>
            <h2>Conoce a quienes quieren representarte</h2>
            <p>Tres equipos, muchas ideas y un mismo compromiso.</p>
          </div>
          <Link href="/candidatos" className="text-link">
            Ver todas las listas <ArrowRight size={16} />
          </Link>
        </div>
        <CandidateCards />
      </section>
      <section className="participation">
        <div className="participation-icon">
          <Sparkles size={26} />
        </div>
        <div>
          <h3>La democracia también se aprende participando.</h3>
          <p>Infórmate, escucha las propuestas y elige con responsabilidad.</p>
        </div>
        <Link href="/estudiantes" className="text-link">
          Cómo participar <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
function Graduation() {
  return <span aria-hidden="true">◈</span>;
}
