import { protectedElection } from "@/lib/connected/session";
import { ConnectedMediaUpload } from "@/components/connected/forms";
export default async function Page({
  params,
}: {
  params: Promise<{ election: string }>;
}) {
  const { election } = await protectedElection((await params).election, true);
  return (
    <section className="panel">
      <h1>Fotografías y símbolos privados</h1>
      <p>
        El archivo se procesa en el servidor, se convierte a WebP sin EXIF/GPS y
        se sube con tu sesión verificada; no utiliza service_role ni enlaces
        públicos.
      </p>
      <ConnectedMediaUpload election={election} />
    </section>
  );
}
