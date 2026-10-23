"use client";
import { useEffect, useState } from "react";
import { ImagePlus, RefreshCw, Check } from "lucide-react";
import { uploadMediaAction, type OperationState } from "@/app/sistema/actions";
export type SavedImage = { path: string; date: string | null };
export function MediaLibrary({ election, selected, onSelect, version = 0 }: { election: string; selected?: string; onSelect?: (path: string) => void; version?: number }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [files, setFiles] = useState<SavedImage[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/sistema/${election}/media/biblioteca?page=${page}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error();
        setFiles(data.files); setMore(data.more);
      } catch {
        if (!controller.signal.aborted) { setFiles([]); setError("No se pudo cargar la biblioteca. Actualiza o revisa tu sesión."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [election, page, refresh, version]);
  return <section className="media-library" aria-label="Biblioteca de imágenes" aria-busy={loading}>
    <div className="library-toolbar"><p>Imágenes privadas de esta elección. Elige una foto o un símbolo autorizado.</p><button type="button" className="button secondary" onClick={() => setRefresh(n => n + 1)} disabled={loading}><RefreshCw size={17} />Actualizar imágenes</button></div>
    {loading ? <p role="status">Cargando imágenes…</p> : error ? <p role="alert">{error}</p> : !files.length ? <div className="library-empty"><ImagePlus size={36} /><strong>Aún no hay imágenes guardadas</strong><p>Sube tu primera foto o símbolo desde tu equipo.</p></div> : <div className="library-grid">{files.map((file, index) => <article className={`library-item ${selected === file.path ? "selected" : ""}`} key={file.path}>
      {/* Private, authenticated image endpoint; never a public URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/sistema/${election}/media/archivo?path=${encodeURIComponent(file.path)}`} alt={`Imagen guardada ${page * 100 + index + 1}`} loading="lazy" />
      {onSelect ? <button className={`button ${selected === file.path ? "primary" : "secondary"}`} type="button" onClick={() => onSelect(file.path)}>{selected === file.path && <Check size={17} />}{selected === file.path ? "Imagen seleccionada" : "Usar esta imagen"}</button> : <strong>Imagen {page * 100 + index + 1}</strong>}
    </article>)}</div>}
    {(page > 0 || more) && <div className="library-toolbar"><button type="button" className="button secondary" disabled={loading || page === 0} onClick={() => setPage(n => n - 1)}>Anteriores</button><span>Página {page + 1}</span><button type="button" className="button secondary" disabled={loading || !more} onClick={() => setPage(n => n + 1)}>Más imágenes</button></div>}
  </section>;
}
export function MediaLibraryManager({ election, editable }: { election: string; editable: boolean }) {
  const [state, setState] = useState<OperationState>({});
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  return <><form className="library-upload" onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setState({});
    try { const result = await uploadMediaAction(election, {}, new FormData(form)); setState(result); if (result.mediaPath) { form.reset(); setVersion(n => n + 1); } }
    catch { setState({ error: "No se pudo guardar la imagen. Inténtalo de nuevo." }); }
    finally { setBusy(false); }
  }}><fieldset disabled={!editable || busy}><legend>Guardar una nueva imagen</legend><label>Foto o símbolo desde mi equipo<input type="file" name="file" accept="image/png,image/jpeg,image/webp" required onChange={event => { if ((event.target.files?.[0]?.size ?? 0) > 3 * 1024 * 1024) { event.target.value = ""; setState({error: "Selecciona una imagen de hasta 3 MB."}); } }} /></label><p>JPG, PNG o WebP, máximo 3 MB. Después podrás elegirla al registrar candidatos.</p><label className="blank-vote"><input type="checkbox" name="consent" value="yes" required />Tengo autorización institucional para usar esta imagen.</label><button className="button primary" disabled={!editable || busy}>{busy ? "Guardando imagen…" : "Guardar en la biblioteca"}</button></fieldset></form>
    {state.error && <p role="alert" className="notice error">{state.error}</p>}{state.mediaPath && <p role="status" className="notice success">Imagen guardada. Ya puedes seleccionarla desde la biblioteca.</p>}
    {!editable && <p className="notice">La biblioteca es de consulta: solo se pueden guardar imágenes mientras la elección está en borrador.</p>}
    <MediaLibrary election={election} version={version} /></>;
}
