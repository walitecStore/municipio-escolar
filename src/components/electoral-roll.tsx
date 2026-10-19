"use client";
import { useRef, useState } from "react";
import { useElectoralDemo } from "./electoral-context";
import {
  Download,
  FileSpreadsheet,
  LockKeyhole,
  Search,
  Users,
  Vote,
  Clock,
} from "lucide-react";
import { institution, grades, sections } from "@/lib/institution";
import {
  isDemoOnly,
  rollSummary,
  validateRows,
  type Elector,
  type ImportResult,
} from "@/lib/roll/model";

export function ElectoralRoll() {
  const {
    electors: students,
    setElectors: setStudents,
    rollLocked,
    setRollLocked,
    state,
  } = useElectoralDemo();
  const locked = rollLocked || state !== "draft";
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{
    original: string;
    record: Elector;
  } | null>(null);
  const [editError, setEditError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const summary = rollSummary(students);
  const filtered = students.filter(
    (s) =>
      `${s.name} ${s.code}`.toLowerCase().includes(query.toLowerCase()) &&
      (!grade || s.grade === Number(grade)) &&
      (!section || s.section === section),
  );
  async function download() {
    setBusy(true);
    try {
      const { makeDemoWorkbook } = await import("@/lib/roll/excel");
      const blob = new Blob([await makeDemoWorkbook()], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "padron-ficticio-230.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("No fue posible generar el archivo de ejemplo.");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file || locked || editing) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx"))
        throw new Error("Selecciona un archivo .xlsx (no .xls ni .xlsm).");
      if (file.size > 2 * 1024 * 1024)
        throw new Error("El archivo supera 2 MB.");
      const { readRollExcel } = await import("@/lib/roll/excel");
      const result = await readRollExcel(await file.arrayBuffer());
      if (!result.errors.length && !isDemoOnly(result.students))
        throw new Error(
          "El modo público solo acepta códigos DEMO-001 y nombres como Estudiante ficticio 001. El padrón real requiere autenticación y RLS aún no conectadas.",
        );
      setPreview(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo leer el archivo.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || locked) return;
    const updated = students.map((s) =>
      s.code === editing.original ? editing.record : s,
    );
    const result = validateRows(
      updated.map((s) => [s.code, s.name, s.grade, s.section]),
    );
    if (result.errors.length) {
      setEditError(result.errors.map((e) => e.message).join(" "));
      return;
    }
    if (!isDemoOnly(result.students)) {
      setEditError(
        "Usa únicamente identificadores y nombres ficticios de la plantilla.",
      );
      return;
    }
    setStudents(result.students);
    setEditing(null);
    setEditError("");
    setMessage(
      "Registro ficticio corregido. Los cambios solo viven en esta página.",
    );
  }
  return (
    <>
      <div className="institution-card">
        <div>
          <span className="eyebrow">
            {institution.level} · {institution.initialYear}
          </span>
          <h2>{institution.name}</h2>
          <p>
            Meta: {institution.expectedStudents} estudiantes · 5 grados · 15
            secciones
          </p>
        </div>
        <span className="badge">
          {locked ? "Simulación bloqueada" : "Borrador editable"}
        </span>
      </div>
      <div className="notice">
        Modo de prueba: usa solamente datos ficticios. El archivo se procesa en
        tu navegador; no se sube ni se guarda. Al recargar se restauran los
        ejemplos. La importación real está deshabilitada hasta disponer de
        autenticación, autorización y RLS.
      </div>
      <section
        className="stats-grid roll-stats"
        aria-label="Resumen del padrón"
      >
        <div className="stat">
          <Users />
          <div>
            <strong>{summary.total}</strong>
            <span>
              Total de electores ficticios / {institution.expectedStudents}
            </span>
          </div>
        </div>
        <div className="stat">
          <Vote />
          <div>
            <strong>{summary.voters}</strong>
            <span>Votantes ficticios</span>
          </div>
        </div>
        <div className="stat">
          <Clock />
          <div>
            <strong>{summary.pending}</strong>
            <span>Pendientes ficticios</span>
          </div>
        </div>
      </section>
      <section className="panel section">
        <div className="section-header">
          <div>
            <h2>Importar padrón desde Excel</h2>
            <p>
              Una hoja, hasta 230 filas. Columnas: codigo, nombre, grado,
              seccion. Tamaño máximo: 2 MB.
            </p>
          </div>
          <FileSpreadsheet size={26} />
        </div>
        <div className="roll-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={download}
          >
            <Download size={16} /> Descargar Excel ficticio (230)
          </button>
          <label
            className={`button primary file-button ${locked || busy ? "disabled" : ""}`}
          >
            Seleccionar Excel ficticio
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              aria-label="Importar Excel ficticio"
              disabled={locked || busy || Boolean(editing)}
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </label>
        </div>
        {busy && <p role="status">Procesando archivo…</p>}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {preview && (
          <div className="import-preview">
            {preview.errors.length ? (
              <>
                <h3>No se importó ningún registro</h3>
                <ul role="alert">
                  {preview.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      Fila {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 20 && (
                  <p>
                    Se muestran los primeros 20 de {preview.errors.length}{" "}
                    errores.
                  </p>
                )}
              </>
            ) : (
              <>
                <h3>
                  {preview.students.length} registros válidos para revisar
                </h3>
                <p>
                  Al confirmar se reemplaza todo el padrón ficticio de esta
                  página, sin mezclar registros anteriores.
                </p>
                <div className="table-scroll">
                  <table aria-label="Vista previa de importación">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Grado</th>
                        <th>Sección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.students.slice(0, 5).map((s) => (
                        <tr key={s.code}>
                          <td>{s.code}</td>
                          <td>{s.name}</td>
                          <td>{s.grade}.º</td>
                          <td>{s.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="button primary"
                  disabled={locked}
                  onClick={() => {
                    if (!locked) {
                      setStudents(preview.students);
                      setPreview(null);
                      setMessage(
                        "Importación ficticia confirmada en memoria. No se guardó ningún archivo ni dato en el servidor.",
                      );
                    }
                  }}
                >
                  Confirmar reemplazo ficticio
                </button>
              </>
            )}
            <button
              className="button secondary"
              onClick={() => setPreview(null)}
            >
              Descartar importación
            </button>
          </div>
        )}
      </section>
      <section className="panel section">
        <h2>Distribución por grado y sección</h2>
        <div className="table-scroll">
          <table aria-label="Distribución por grado y sección">
            <thead>
              <tr>
                <th>Grado</th>
                {sections.map((s) => (
                  <th key={s}>Sección {s}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g}>
                  <th>{g}.º</th>
                  {sections.map((s) => (
                    <td key={s}>
                      {
                        summary.classrooms.find(
                          (c) => c.grade === g && c.section === s,
                        )?.count
                      }
                    </td>
                  ))}
                  <td>{students.filter((s) => s.grade === g).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel section">
        <div className="table-toolbar">
          <div>
            <h2>Estudiantes ficticios</h2>
            <p>
              {filtered.length} de {students.length} registros · Códigos únicos
            </p>
          </div>
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Buscar estudiantes ficticios"
              placeholder="Buscar nombre o código…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="roll-filters">
          <label>
            Grado
            <select
              aria-label="Filtrar grado"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">Todos los grados</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}.º
                </option>
              ))}
            </select>
          </label>
          <label>
            Sección
            <select
              aria-label="Filtrar sección"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">Todas las secciones</option>
              {sections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table aria-label="Padrón de estudiantes">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estudiante</th>
                <th>Grado</th>
                <th>Sección</th>
                <th>Participación ficticia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.code}>
                  <td>{s.code}</td>
                  <td className="student-name">{s.name}</td>
                  <td>{s.grade}.º</td>
                  <td>{s.section}</td>
                  <td>
                    <span className="badge">
                      {s.voted ? "Participó (demo)" : "Pendiente"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="text-link"
                      disabled={locked || busy || Boolean(preview)}
                      onClick={() => {
                        setEditing({ original: s.code, record: { ...s } });
                        setEditError("");
                      }}
                    >
                      Corregir {s.code}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p role="status" className="empty">
            No hay estudiantes que coincidan con la búsqueda.
          </p>
        )}
      </section>
      {editing && (
        <section className="panel section" aria-label="Corregir registro">
          <h2>Corregir registro ficticio</h2>
          <form onSubmit={saveEdit}>
            <label htmlFor="edit-code">Código</label>
            <input
              id="edit-code"
              value={editing.record.code}
              required
              maxLength={30}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  record: { ...editing.record, code: e.target.value },
                })
              }
            />
            <label htmlFor="edit-name">Nombre ficticio</label>
            <input
              id="edit-name"
              value={editing.record.name}
              required
              maxLength={120}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  record: { ...editing.record, name: e.target.value },
                })
              }
            />
            <label htmlFor="edit-grade">Grado del registro</label>
            <select
              id="edit-grade"
              value={editing.record.grade}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  record: { ...editing.record, grade: Number(e.target.value) },
                })
              }
            >
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}.º
                </option>
              ))}
            </select>
            <label htmlFor="edit-section">Sección del registro</label>
            <select
              id="edit-section"
              value={editing.record.section}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  record: { ...editing.record, section: e.target.value },
                })
              }
            >
              {sections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {editError && <p role="alert">{editError}</p>}
            <div className="roll-actions">
              <button className="button primary" disabled={locked}>
                Guardar corrección ficticia
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar corrección
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel section">
        <h2>
          <LockKeyhole size={20} /> Cierre de edición y credenciales
        </h2>
        <p>
          La simulación permite bloquear las correcciones al completar 230
          registros. No abre una elección real, no emite credenciales y no
          habilita votos.
        </p>
        <button
          className="button primary"
          disabled={
            locked ||
            busy ||
            Boolean(editing) ||
            Boolean(preview) ||
            students.length !== institution.expectedStudents
          }
          onClick={() => {
            setRollLocked(true);
            setMessage(
              "Padrón ficticio bloqueado. La elección real permanece deshabilitada.",
            );
          }}
        >
          Simular cierre de edición
        </button>
        <p>
          Las credenciales reales requieren emisión desde un servidor
          autorizado: token aleatorio individual, almacenamiento solo del hash,
          caducidad y uso único. El diseño SQL pendiente de despliegue protege
          el padrón con RLS y bloquea el doble voto de forma transaccional.
        </p>
      </section>
    </>
  );
}
