import { Heading } from "@/components/ui";
import { LoginForm } from "@/components/connected/auth-forms";
import { integrationConfig } from "@/lib/connected/env";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="ACCESO AUTORIZADO"
        title="Iniciar sesión electoral"
        description="Acceso real mediante Supabase Auth. No se permite registro público ni se usan cuentas de demostración para autenticar."
      />
      <section className="panel">
        {integrationConfig() ? (
          <LoginForm />
        ) : (
          <div className="notice">
            La integración está deshabilitada o incompleta. Configura las
            variables del servidor siguiendo docs/ACTIVACION-SUPABASE.md. No se
            enviaron credenciales ni se contactó a Supabase.
          </div>
        )}
      </section>
    </>
  );
}
