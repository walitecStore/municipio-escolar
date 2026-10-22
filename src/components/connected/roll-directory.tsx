"use client";
import { useState } from "react";
import { Search, FilterX, Download, FileSpreadsheet } from "lucide-react";
import type { ConnectedElector } from "@/lib/connected/data";
export function RollDirectory({
  students,
  supervised,
}: {
  students: ConnectedElector[];
  supervised: boolean;
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const normalized = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = students.filter(
    (s) =>
      (!grade || s.grade === Number(grade)) &&
      (!section || s.section === section) &&
      normalized(`${s.code} ${s.full_name}`).includes(normalized(query.trim())),
  );
  return (
    <>
      <div className="directory-filters">
        <label>
          <span>
            <Search size={17} aria-hidden="true" />
            Buscar estudiante
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, apellidos o DNI"
            autoComplete="off"
          />
        </label>
        <label>
          Grado
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Todos los grados</option>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                {g}.º
              </option>
            ))}
          </select>
        </label>
        <label>
          Sección
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">Todas las secciones</option>
            {["A", "B", "C"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {(query || grade || section) && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setQuery("");
              setGrade("");
              setSection("");
            }}
          >
            <FilterX size={17} aria-hidden="true" />
            Limpiar filtros
          </button>
        )}
      </div>
      <p className="directory-count" role="status">
        {filtered.length} de {students.length} estudiantes
      </p>
      <div className="table-scroll">
        <table aria-label="Padrón electoral">
          <thead>
            <tr>
              <th>DNI / código</th>
              <th>Nombres y apellidos</th>
              <th>Grado</th>
              <th>Sección</th>
              <th>{supervised ? "Modalidad" : "Cuenta vinculada"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="document-number">{s.code}</span>
                </td>
                <td>{s.full_name}</td>
                <td>{s.grade}.º</td>
                <td>{s.section}</td>
                <td>
                  {supervised
                    ? "DNI presencial"
                    : s.auth_user_id
                      ? "Sí"
                      : "Pendiente"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="directory-empty">
          <Search size={30} aria-hidden="true" />
          <strong>
            {students.length
              ? "No encontramos coincidencias"
              : "Tu padrón está vacío"}
          </strong>
          <p>
            {students.length
              ? "Prueba otro nombre o limpia los filtros."
              : "Importa el Excel de estudiantes para empezar."}
          </p>
        </div>
      )}
    </>
  );
}
export function RollTemplate({ official }: { official: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="template-download">
      <span className="template-icon">
        <FileSpreadsheet size={26} aria-hidden="true" />
      </span>
      <div>
        <strong>Prepara tu archivo sin complicaciones</strong>
        <p>
          Descarga la plantilla, completa los estudiantes y guarda el DNI como
          texto de ocho dígitos.
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const ExcelJS = await import("exceljs");
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Estudiantes");
            sheet.columns = [
              { header: official ? "dni" : "codigo", key: "dni", width: 16 },
              { header: "nombre", key: "nombre", width: 45 },
              { header: "grado", key: "grado", width: 12 },
              { header: "seccion", key: "seccion", width: 12 },
            ];
            sheet.getColumn(1).numFmt = "@";
            sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
            sheet.getRow(1).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF1763C7" },
            };
            const data = await workbook.xlsx.writeBuffer();
            const url = URL.createObjectURL(
              new Blob([new Uint8Array(data)], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "plantilla-padron.xlsx";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } catch {
            setError("No se pudo preparar la plantilla. Inténtalo de nuevo.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={18} aria-hidden="true" />
        {busy ? "Preparando…" : "Descargar plantilla Excel"}
      </button>
    </div>
  );
}
