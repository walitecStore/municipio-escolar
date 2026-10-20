import Link from "next/link";
import { Heading } from "@/components/ui";
import { LoginForm } from "@/components/connected/auth-forms";
import { integrationConfig } from "@/lib/connected/env";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ password?: string; sessions?: string }>;
}) {
  const status = await searchParams;
  return (
    <>
      <Heading
        eyebrow="ACCESO AUTORIZADO"
        title="Iniciar sesión electoral"
        description="Acceso real mediante Supabase Auth. No se permite registro público ni se usan cuentas de demostración para autenticar."
      />
      <section className="panel">
        {status.password === "updated" && (
          <p role="status">Tu contraseña se actualizó correctamente</p>
        )}
        {status.password === "updated" && status.sessions === "pending" && (
          <p role="alert">
            La revocación de otras sesiones no pudo confirmarse; contacta al
            responsable.
          </p>
        )}
        {integrationConfig() ? (
          <LoginForm />
        ) : (
          <div className="notice">
            La integración está deshabilitada o incompleta. Configura las
            variables del servidor siguiendo docs/ACTIVACION-SUPABASE.md. No se
            enviaron credenciales ni se contactó a Supabase.
          </div>
        )}
        <Link className="text-link" href="/sistema/restablecer">
          Olvidé mi contraseña
        </Link>
      </section>
    </>
  );
}
