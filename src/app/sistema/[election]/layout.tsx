import Link from "next/link";
import { protectedElection } from "@/lib/connected/session";
import { isStaff } from "@/lib/connected/policy";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ election: string }>;
}) {
  const id = (await params).election;
  const { session, election } = await protectedElection(id);
  const links = isStaff(session)
    ? [
        ["", "Resumen"],
        ["/configuracion", "Configuración"],
        ["/padron", "Padrón"],
        ["/listas", "Listas y candidatos"],
        ["/credenciales", "Credenciales"],
        ["/presencial", "Mesas · DNI"],
        ["/media", "Fotografías"],
        ["/resultados", "Resultados"],
      ]
    : [
        ["", "Mi elección"],
        ["/listas", "Candidaturas"],
        ["/votar", "Votación"],
      ];
  return (
    <>
      <p className="notice">
        {election.purpose === "test"
          ? "PRUEBAS · Solo datos ficticios"
          : "INSTITUCIONAL · Preparación oficial"}{" "}
        · {election.year} · Estado:{" "}
        {election.state === "draft"
          ? "Borrador"
          : election.state === "open"
            ? "Abierta"
            : "Cerrada"}
        {election.purpose === "official" && !election.security_approved
          ? " · Aprobación de seguridad pendiente"
          : ""}
      </p>
      <nav className="election-subnav" aria-label="Navegación de la elección">
        {links.map(([suffix, label]) => (
          <Link
            className="button secondary"
            href={`/sistema/${id}${suffix}`}
            key={suffix}
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
