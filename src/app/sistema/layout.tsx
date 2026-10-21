import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};
export default function ConnectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="notice">
        GESTIÓN ELECTORAL · Preparar un borrador no abre la votación. Cada
        elección indica su modalidad y estado.{" "}
        <Link className="text-link" href="/sistema">
          Inicio del sistema
        </Link>
      </div>
      {children}
    </>
  );
}
