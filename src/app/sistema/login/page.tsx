import Link from "next/link";
import { WorkspaceHeading } from "@/components/connected/workspace-ui";
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
      <WorkspaceHeading
        icon="access"
        eyebrow="BIENVENIDO A TU COMUNIDAD"
        title="Iniciar sesión electoral"
      >
        Ingresa con tu cuenta personal para continuar con la gestión de tu
        institución.
      </WorkspaceHeading>
      <section className="panel focused-form">
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
