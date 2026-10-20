import { Heading } from "@/components/ui";
import { RecoveryForm } from "@/components/connected/password-forms";
import { integrationConfig } from "@/lib/connected/env";
export default function Page() {
  return (
    <>
      <Heading
        eyebrow="RECUPERACIÓN SEGURA"
        title="Restablecer contraseña"
        description="Recuperación para administradores y comité electoral. Después deberás iniciar sesión y verificar MFA para acceder al panel."
      />
      <section className="panel">
        {integrationConfig() ? (
          <RecoveryForm />
        ) : (
          <p>
            La integración está deshabilitada o incompleta. Contacta al
            responsable.
          </p>
        )}
      </section>
    </>
  );
}
