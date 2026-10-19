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
        ÁREA CONECTADA · Solo identidades ficticias durante las pruebas. La
        emisión de votos y la activación oficial requieren habilitación
        explícita del operador.{" "}
        <Link className="text-link" href="/sistema">
          Inicio del sistema
        </Link>
      </div>
      {children}
    </>
  );
}
