import { ElectoralProvider } from "@/components/electoral-context";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import { recoveryBootstrap } from "@/lib/connected/recovery-bootstrap";
export const metadata: Metadata = {
  title: {
    default: "Elecciones del Municipio Escolar",
    template: "%s | Municipio Escolar",
  },
  description:
    "Plataforma institucional de elecciones del Municipio Escolar de la I.E. ESTEBAN PAVLETICH TRUJILLO.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: recoveryBootstrap }} />
      </head>
      <body>
        <ElectoralProvider>
          <Shell>{children}</Shell>
        </ElectoralProvider>
      </body>
    </html>
  );
}
