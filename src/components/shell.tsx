"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicInstitution } from "@/lib/platform";
import {
  GraduationCap,
  House,
  Users,
  ListChecks,
  Vote,
  ChartNoAxesCombined,
  LayoutDashboard,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
const links = [
  ["/demostracion", "Inicio (demo)", House],
  ["/estudiantes", "Acceso de estudiantes", Users],
  ["/administracion", "Administración (demo)", LayoutDashboard],
  ["/padron", "Padrón (demo)", ListChecks],
  ["/candidatos", "Listas y candidatos", Users],
  ["/votacion", "Simulador de votación", Vote],
  ["/resultados", "Resultados (demo)", ChartNoAxesCombined],
] as const;
export function Shell({
  children,
  institution,
  showDemonstrations = false,
}: {
  children: React.ReactNode;
  institution: PublicInstitution;
  showDemonstrations?: boolean;
}) {
  const path = usePathname();
  const connected = path.startsWith("/sistema");
  const demo = links.some(([href]) => href === path);
  return (
    <>
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <GraduationCap size={27} />
          </span>
          <span>
            Municipio<span className="brand-sub">ESCOLAR · PERÚ</span>
          </span>
        </Link>
        <div className="sidebar-label">PLATAFORMA INSTITUCIONAL</div>
        <nav aria-label="Navegación institucional">
          <Link className={`nav-link ${path === "/" ? "active" : ""}`} href="/">
            <House size={19} />
            Inicio institucional
          </Link>
          <Link
            className={`nav-link ${connected ? "active" : ""}`}
            href="/sistema"
          >
            <ShieldCheck size={19} />
            Panel electoral
          </Link>
          <Link className="nav-link" href="/sistema/login">
            <Users size={19} />
            Acceso al sistema
          </Link>
        </nav>
        {showDemonstrations && (
          <details className="demo-navigation" open={demo}>
            <summary>Recorrido de demostración</summary>
            <nav aria-label="Navegación principal">
              {links.map(([href, label, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link ${path === href ? "active" : ""}`}
                  aria-current={path === href ? "page" : undefined}
                >
                  <Icon size={19} />
                  {label}
                </Link>
              ))}
            </nav>
          </details>
        )}
        <div className="sidebar-bottom">
          <div className="shield-circle">
            <ShieldCheck size={22} />
          </div>
          <strong>Tu voz cuenta.</strong>
          <p>Participar es el primer paso para transformar tu escuela.</p>
          <span>Democracia que se aprende</span>
        </div>
        <div className="sidebar-foot">
          Hecho para nuestra comunidad <span>↗</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            {institution.name} <span className="top-divider">/</span>{" "}
            <strong>Elecciones escolares</strong>
          </span>
          <Link href="/sistema/login" className="access-link">
            Ingreso al sistema <ArrowUpRight size={16} />
          </Link>
        </header>
        <div className="demo-banner">
          <span className="demo-dot" />
          {demo
            ? "ENTORNO DE DEMOSTRACIÓN"
            : connected
              ? "GESTIÓN ELECTORAL PROTEGIDA"
              : "PLATAFORMA INSTITUCIONAL"}
          <span className="banner-text">
            {demo
              ? "Datos ficticios. No se registran votos oficiales."
              : connected
                ? "Acceso autorizado. La modalidad y el estado se indican dentro de cada elección."
                : institution.name}
          </span>
        </div>
        <main id="contenido">{children}</main>
        <footer>
          <span>
            © 2026 Municipio Escolar · Aprendemos a vivir en democracia.
          </span>
          <span>
            {demo ? "Demostración" : "Acceso institucional"}{" "}
            <span className="green-dot" />
          </span>
        </footer>
      </div>
    </>
  );
}
