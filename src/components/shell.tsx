"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { institution } from "@/lib/institution";
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
  ["/", "Inicio", House],
  ["/estudiantes", "Acceso de estudiantes", Users],
  ["/administracion", "Administración (demo)", LayoutDashboard],
  ["/padron", "Padrón (demo)", ListChecks],
  ["/candidatos", "Listas y candidatos", Users],
  ["/votacion", "Simulador de votación", Vote],
  ["/resultados", "Resultados (demo)", ChartNoAxesCombined],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const connected = path.startsWith("/sistema");
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
        <div className="sidebar-label">RECORRIDO DE DEMOSTRACIÓN</div>
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
          <div className="sidebar-label sidebar-label-secure">GESTIÓN REAL · ACCESO RESTRINGIDO</div>
          <Link
            className={`nav-link secure-nav-link ${connected ? "active" : ""}`}
            href="/sistema"
          >
            <ShieldCheck size={19} />
            Abrir panel seguro
          </Link>
        </nav>
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
          <span className="demo-dot" />{" "}
          {connected
            ? "ÁREA DE INTEGRACIÓN PROTEGIDA"
            : "ENTORNO DE DEMOSTRACIÓN"}{" "}
          <span className="banner-text">
            {connected
              ? "Consulta el estado de configuración y activación dentro del sistema."
              : "Las pantallas de este menú usan datos ficticios. Para gestionar elecciones, entra al panel seguro."}
          </span>
        </div>
        <main id="contenido">{children}</main>
        <footer>
          <span>
            © 2026 Municipio Escolar · Aprendemos a vivir en democracia.
          </span>
          <span>
            Entorno de pruebas <span className="green-dot" />
          </span>
        </footer>
      </div>
    </>
  );
}
