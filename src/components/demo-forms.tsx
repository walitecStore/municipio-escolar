"use client";
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { lists } from "@/lib/demo";
export function StudentAccess() {
  const [message, setMessage] = useState(false);
  return (
    <div className="access-grid">
      <section className="panel">
        <h2>Bienvenido a tu espacio</h2>
        <p>Explora cómo será el acceso de estudiantes.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(true);
          }}
        >
          <label htmlFor="code">Código de estudiante ficticio</label>
          <input
            id="code"
            placeholder="Ej. EST-001"
            required
            autoComplete="off"
            maxLength={30}
          />
          <label htmlFor="grade">Grado</label>
          <select id="grade">
            <option>1.º de secundaria</option>
            <option>2.º de secundaria</option>
            <option>3.º de secundaria</option>
            <option>4.º de secundaria</option>
            <option>5.º de secundaria</option>
          </select>
          <button className="button primary" type="submit">
            Probar acceso de demostración
          </button>
        </form>
        {message && (
          <div className="notice" role="status">
            Demostración completada. No se verificó tu identidad ni se inició
            una sesión. Puedes explorar la votación desde el menú.
          </div>
        )}
      </section>
      <aside className="panel soft-panel">
        <ShieldCheck size={36} />
        <h2>Participación responsable</h2>
        <p>No ingreses tu DNI, contraseña ni datos personales reales.</p>
        <p>
          El acceso seguro se incorporará cuando se configure la autenticación y
          la autorización del servidor.
        </p>
        <span className="badge">Sin conexión a servicios externos</span>
      </aside>
    </div>
  );
}
export function DemoVote() {
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel">
      <div className="notice">
        Solo demostración: tu elección no se envía, no se almacena y no modifica
        los resultados.
      </div>
      {confirmed ? (
        <div className="vote-done" role="status">
          <CheckCircle2 size={52} />
          <h2>Recorrido de demostración completado</h2>
          <p>
            Seleccionaste:{" "}
            {lists.find((l) => l.id === selected)?.name ?? "Voto en blanco"}.
          </p>
          <p>No se ha emitido ni registrado ningún voto oficial.</p>
          <button
            className="button primary"
            onClick={() => {
              setSelected("");
              setConfirmed(false);
            }}
          >
            Reiniciar demostración
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selected) setConfirmed(true);
          }}
        >
          <fieldset>
            <legend>Selecciona una opción ficticia</legend>
            <div className="vote-grid">
              {lists.map((l) => (
                <label
                  key={l.id}
                  className={`vote-option ${selected === l.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="candidate"
                    value={l.id}
                    checked={selected === l.id}
                    onChange={() => setSelected(l.id)}
                    required
                  />
                  <Image
                    src={l.photo}
                    alt={`Fotografía referencial de la candidatura ficticia ${l.candidate}`}
                    width={100}
                    height={100}
                  />
                  <span className="small-label">LISTA {l.id}</span>
                  <strong>{l.name}</strong>
                  <span>{l.candidate}</span>
                </label>
              ))}
            </div>
            <label className="blank-vote">
              <input
                type="radio"
                name="candidate"
                value="blank"
                checked={selected === "blank"}
                onChange={() => setSelected("blank")}
              />{" "}
              Voto en blanco de demostración
            </label>
          </fieldset>
          <button type="submit" className="button primary" disabled={!selected}>
            Confirmar selección de demostración
          </button>
        </form>
      )}
    </section>
  );
}
