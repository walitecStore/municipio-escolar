"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { PublicInstitution } from "@/lib/platform";
import {
  School,
  House,
  Users,
  ListChecks,
  Vote,
  ChartNoAxesCombined,
  LayoutDashboard,
  ShieldCheck,
  CircleHelp,
  Menu,
  X,
  UserRound,
  LogIn,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
const demoLinks = [
  ["/demostracion", "Inicio (demo)", House],
  ["/estudiantes", "Acceso de estudiantes", Users],
  ["/administracion", "Administración (demo)", LayoutDashboard],
  ["/padron", "Padrón (demo)", ListChecks],
  ["/candidatos", "Listas y candidatos", Users],
  ["/votacion", "Simulador de votación", Vote],
  ["/resultados", "Resultados (demo)", ChartNoAxesCombined],
] as const;
const pageNames: Record<string, string> = {
  invitacion: "Activar acceso personal",
  perfil: "Perfil y seguridad",
  instituciones: "Mi institución y equipo",
  preparacion: "Preparación institucional",
  nueva: "Nueva elección",
  configuracion: "Configuración",
  padron: "Padrón electoral",
  listas: "Registrar candidato y plana de regiduría",
  candidatos: "Mostrar candidatos",
  presencial: "Mesas · DNI",
  credenciales: "Credenciales",
  media: "Fotografías y símbolos",
  resultados: "Resultados",
  actas: "Actas y documentos",
  votar: "Votación",
  login: "Acceso al sistema",
  mfa: "Verificación de identidad",
  restablecer: "Restablecer contraseña",
  ayuda: "Ayuda",
};
function PageTrail({ path }: { path: string }) {
  if (
    path === "/" ||
    path === "/sistema/mesa" ||
    demoLinks.some(([href]) => href === path)
  )
    return null;
  const match = path.match(/^\/sistema\/([a-f0-9-]{36})(?:\/(.+))?$/i);
  const parent = match?.[2]
    ? `/sistema/${match[1]}`
    : path === "/sistema" || path === "/ayuda" || path === "/sistema/login"
      ? "/"
      : path === "/sistema/restablecer"
        ? "/sistema/login"
        : "/sistema";
  const label = match?.[2]
    ? "Volver a la elección"
    : parent === "/"
      ? "Volver al inicio"
      : parent === "/sistema/login"
        ? "Volver al acceso"
        : "Volver al panel";
  const current =
    match && !match[2]
      ? "Mi elección"
      : (pageNames[path.split("/").at(-1) ?? ""] ?? "Panel electoral");
  return (
    <div className="page-trail">
      <Link href={parent} className={match?.[2] ? "button secondary election-menu-back" : undefined}>
        <ArrowLeft size={18} aria-hidden="true" />
        {label}
      </Link>
      <span>
        <ChevronRight size={14} aria-hidden="true" />
        {current}
      </span>
    </div>
  );
}
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
  const [more, setMore] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const demo = demoLinks.some(([href]) => href === path);
  const booth = path === "/sistema/mesa";
  useEffect(() => {
    if (!more) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMore(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [more]);
  return (
    <div className={`app-shell${booth ? " booth-shell" : ""}`}>
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      {!booth && (
        <aside className={`sidebar${more ? " more-expanded" : ""}`}>
          <Link href="/" className="brand">
            <span className="brand-icon">
              <School size={31} aria-hidden="true" />
            </span>
            <span>
              Elecciones<span className="brand-sub">MUNICIPIO ESCOLAR</span>
            </span>
          </Link>
          <div className="sidebar-label">TU COMUNIDAD, TU VOZ</div>
          <nav aria-label="Navegación institucional" className="platform-nav">
            <Link
              onClick={() => setMore(false)}
              href="/"
              className={`nav-link${path === "/" ? " active" : ""}`}
              aria-current={path === "/" ? "page" : undefined}
            >
              <House size={22} aria-hidden="true" />
              <span>Inicio institucional</span>
            </Link>
            <Link
              onClick={() => setMore(false)}
              href="/sistema"
              className={`nav-link${path.startsWith("/sistema") ? " active" : ""}`}
              aria-current={path === "/sistema" ? "page" : undefined}
            >
              <LayoutDashboard size={22} aria-hidden="true" />
              <span>Panel electoral</span>
            </Link>
            <Link
              onClick={() => setMore(false)}
              href="/ayuda"
              className={`nav-link${path === "/ayuda" ? " active" : ""}`}
              aria-current={path === "/ayuda" ? "page" : undefined}
            >
              <CircleHelp size={22} aria-hidden="true" />
              <span>Ayuda</span>
            </Link>
            <button
              ref={menuButton}
              className="nav-link more-toggle"
              aria-expanded={more}
              aria-controls="platform-more-menu"
              onClick={() => setMore(!more)}
            >
              {more ? (
                <X size={22} aria-hidden="true" />
              ) : (
                <Menu size={22} aria-hidden="true" />
              )}
              <span>Más</span>
            </button>
            <div className="more-panel" id="platform-more-menu">
              <span className="sidebar-label">MI CUENTA</span>
              <Link
                onClick={() => setMore(false)}
                className="nav-link"
                href="/sistema/perfil"
              >
                <UserRound size={21} aria-hidden="true" />
                <span>Perfil y seguridad</span>
              </Link>
              <Link
                onClick={() => setMore(false)}
                className="nav-link"
                href="/sistema/login"
              >
                <LogIn size={21} aria-hidden="true" />
                <span>Acceso al sistema</span>
              </Link>
            </div>
          </nav>
          {showDemonstrations && (
            <details className="demo-navigation" open={demo}>
              <summary>Recorrido de demostración</summary>
              <nav aria-label="Navegación principal">
                {demoLinks.map(([href, label, Icon]) => (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link${path === href ? " active" : ""}`}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
          )}
          <div className="sidebar-bottom">
            <span className="shield-circle">
              <ShieldCheck size={24} aria-hidden="true" />
            </span>
            <strong>Tu voz construye.</strong>
            <p>Una comunidad que participa, una escuela que avanza.</p>
            <span>Democracia que se aprende</span>
          </div>
        </aside>
      )}
      <div className="workspace">
        <header className="topbar">
          <span className="mobile-brand">
            <School size={31} aria-hidden="true" />
            <span>
              Elecciones<strong>Municipio Escolar</strong>
            </span>
          </span>
          <span className="desktop-heading">
            {institution.name}
            <small>Democracia y participación para una mejor escuela</small>
          </span>
          <span className="trust-badge">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{booth ? "Mesa de votación" : "Acceso protegido"}</span>
          </span>
        </header>
        {demo && (
          <div className="demo-banner">
            <span className="demo-dot" />
            ENTORNO DE DEMOSTRACIÓN
            <span className="banner-text">
              Datos ficticios. No se registran votos oficiales.
            </span>
          </div>
        )}
        <main id="contenido">
          <PageTrail path={path} />
          {children}
        </main>
        <footer>
          <span>Municipio Escolar · Tu participación transforma.</span>
          <span>
            <span className="green-dot" />
            Educación y democracia
          </span>
        </footer>
      </div>
    </div>
  );
}
