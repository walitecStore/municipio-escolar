import { demonstrationsEnabled, publicInstitution } from "@/lib/platform";
import { ElectoralProvider } from "@/components/electoral-context";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import { recoveryBootstrap } from "@/lib/connected/recovery-bootstrap";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Elecciones del Municipio Escolar",
    template: "%s | Municipio Escolar",
  },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/app-192.png", apple: "/icons/app-192.png" },
  description: "Plataforma de gestión de elecciones del Municipio Escolar.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const showDemonstrations = demonstrationsEnabled();
  const content = (
    <Shell
      institution={publicInstitution()}
      showDemonstrations={showDemonstrations}
    >
      {children}
    </Shell>
  );
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: recoveryBootstrap }} />
      </head>
      <body>
        {showDemonstrations ? (
          <ElectoralProvider>{content}</ElectoralProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
