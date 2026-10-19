"use client";
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useElectoralDemo } from "./electoral-context";
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
  const { slates } = useElectoralDemo();
  const [review, setReview] = useState(false);
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
            {slates.find((l) => l.id === selected)?.name ?? "Voto en blanco"}.
          </p>
          <p>No se ha emitido ni registrado ningún voto oficial.</p>
          <button
            className="button primary"
            onClick={() => {
              setSelected("");
              setConfirmed(false);
              setReview(false);
            }}
          >
            Reiniciar demostración
          </button>
        </div>
      ) : review ? (
        <div className="vote-review" aria-label="Confirmación de selección">
          <h2>Revisa tu selección</h2>
          <p>
            {slates.find((l) => l.id === selected)?.name ?? "Voto en blanco"}
          </p>
          <p>
            Esta demostración no registra votos. En el sistema conectado, la
            confirmación enviará una única solicitud protegida; si se pierde la
            respuesta, se consultará el estado antes de reintentar.
          </p>
          <div className="roll-actions">
            <button
              className="button secondary"
              onClick={() => setReview(false)}
            >
              Volver a elegir
            </button>
            <button
              className="button primary"
              onClick={() => setConfirmed(true)}
            >
              Completar demostración
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selected) setReview(true);
          }}
        >
          <fieldset>
            <legend>Selecciona una opción ficticia</legend>
            <div className="vote-grid">
              {slates.map((l) => {
                const mayor = l.candidates.find((c) => c.role === "alcalde")!;
                return (
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
                      src={mayor.photo}
                      alt={`Fotografía referencial de la candidatura ficticia ${mayor.name}`}
                      width={100}
                      height={100}
                    />
                    <span className="small-label">
                      LISTA {String(l.number).padStart(2, "0")}
                    </span>
                    <strong>{l.name}</strong>
                    <span>{mayor.name}</span>
                  </label>
                );
              })}
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
