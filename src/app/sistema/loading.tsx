export default function Loading() {
  return (
    <section
      className="panel workspace-loading"
      aria-busy="true"
      aria-label="Cargando sección"
    >
      <span className="loading-dot" />
      <h2>Estamos preparando tu espacio</h2>
      <p>Consultando la información de tu institución…</p>
      <div className="loading-line" />
      <div className="loading-line short" />
    </section>
  );
}
