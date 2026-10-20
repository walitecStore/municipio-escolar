import { RecoveryForm } from "@/components/connected/password-forms";
import { integrationConfig } from "@/lib/connected/env";
export default function Page() {
  return (
    <div className="recovery-wrap">
      <section className="panel recovery-card">
        {integrationConfig() ? (
          <RecoveryForm />
        ) : (
          <>
            <h1>RESTABLECER CONTRASEÑA</h1>
            <p>
              La integración está deshabilitada o incompleta. Contacta al
              responsable.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
