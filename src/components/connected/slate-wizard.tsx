"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  ImagePlus,
  Save,
  UserRound,
  UsersRound,
} from "lucide-react";
import { registerSlateAction } from "@/app/sistema/[election]/listas/wizard-actions";
import {
  slateRegidorSchema,
  slateStudentSchema,
} from "@/lib/connected/slate-registration";
type Student = { name: string; grade: string; section: string };
type Regidor = Student & { title: string };
const emptyStudent = (): Student => ({ name: "", grade: "", section: "" });
const emptyRegidor = (): Regidor => ({ ...emptyStudent(), title: "" });
function WizardImage({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="wizard-image-field">
      <div className="wizard-image-preview">
        {file && preview /* Local preview only. */ ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Vista previa de ${label.toLowerCase()}`} />
        ) : (
          <ImagePlus size={46} aria-hidden="true" />
        )}
      </div>
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            if (
              next &&
              (next.size > 3 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(next.type))
            ) {
              setError("Selecciona JPG, PNG o WebP de hasta 3 MB.");
              event.target.value = "";
              return;
            }
            setError("");
            onChange(next);
          }}
        />
      </label>
      <p>
        {file
          ? `Seleccionado: ${file.name}`
          : "Puedes elegir un archivo desde tu celular o computadora."}{" "}
        JPG, PNG o WebP, máximo 3 MB.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function StudentFields({
  value,
  onChange,
  prefix,
}: {
  value: Student;
  onChange: (next: Student) => void;
  prefix: "candidato" | "regidor";
}) {
  return (
    <>
      <label>
        Nombres y apellidos del {prefix}
        <input
          autoComplete="off"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          maxLength={120}
        />
      </label>
      <div className="wizard-student-class">
        <label>
          Grado del {prefix}
          <select
            value={value.grade}
            onChange={(e) => onChange({ ...value, grade: e.target.value })}
          >
            <option value="">Selecciona el grado</option>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                {g}.º
              </option>
            ))}
          </select>
        </label>
        <label>
          Sección del {prefix}
          <select
            value={value.section}
            onChange={(e) => onChange({ ...value, section: e.target.value })}
          >
            <option value="">Selecciona la sección</option>
            {["A", "B", "C"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
export function SlateWizard({ election }: { election: string }) {
  const [step, setStep] = useState(0);
  const [mayor, setMayor] = useState<Student>(emptyStudent);
  const [party, setParty] = useState("");
  const [proposals, setProposals] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [symbol, setSymbol] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [regidors, setRegidors] = useState<Regidor[]>([emptyRegidor()]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState<{ id: string; number: number } | null>(
    null,
  );
  const request = useRef("");
  const title = useRef<HTMLHeadingElement>(null);
  const steps = [
    "Candidato",
    "Partido",
    "Foto del candidato",
    "Símbolo del partido",
    "Plana de regiduría",
  ];
  const go = (target: number) => {
    setError("");
    setStep(target);
    queueMicrotask(() => title.current?.focus());
  };
  const updateRegidor = (next: Regidor) =>
    setRegidors((rows) => rows.map((row, n) => (n === index ? next : row)));
  const validRegidor = (row: Regidor) => {
    const result = slateRegidorSchema.safeParse(row);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return false;
    }
    return true;
  };
  function next() {
    if (step === 0) {
      const parsed = slateStudentSchema.safeParse(mayor);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }
    if (step === 1 && (!party.trim() || !proposals.trim())) {
      setError(
        "Escribe el nombre del partido y al menos una propuesta antes de continuar.",
      );
      return;
    }
    if (step === 2 && !photo) {
      setError("Selecciona la fotografía del candidato antes de continuar.");
      return;
    }
    if (
      step === 3 &&
      photo &&
      symbol &&
      photo.size + symbol.size > 4 * 1024 * 1024
    ) {
      setError(
        "La foto y el símbolo juntos deben ocupar como máximo 4 MB. Elige una versión más pequeña de una de las imágenes.",
      );
      return;
    }
    if (step === 3 && (!symbol || !consent)) {
      setError(
        !symbol
          ? "Selecciona el símbolo del partido."
          : "Confirma la autorización para utilizar las imágenes.",
      );
      return;
    }
    if (step < 4) {
      go(step + 1);
      return;
    }
    if (!validRegidor(regidors[index])) return;
    if (index === 19) {
      setError(
        "Ya llegaste al máximo de 20 regidores. Pulsa Terminar registro.",
      );
      return;
    }
    if (index === regidors.length - 1)
      setRegidors((rows) => [...rows, emptyRegidor()]);
    setIndex(index + 1);
    setError("");
    queueMicrotask(() => title.current?.focus());
  }
  async function finish() {
    let complete = regidors;
    const last = complete.at(-1)!;
    if (
      complete.length > 1 &&
      !last.name.trim() &&
      !last.title.trim() &&
      !last.grade &&
      !last.section
    )
      complete = complete.slice(0, -1);
    for (let n = 0; n < complete.length; n++) {
      if (!validRegidor(complete[n])) {
        setIndex(n);
        return;
      }
    }
    if (!photo || !symbol || !consent) {
      setError("Revisa la foto, el símbolo y la autorización de imágenes.");
      return;
    }
    if (!request.current) request.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          request: request.current,
          party,
          proposals: proposals
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean),
          mayor,
          regidors: complete,
        }),
      );
      form.set("photo", photo);
      form.set("symbol", symbol);
      form.set("consent", "yes");
      const result = await registerSlateAction(election, form);
      if (result.id && result.number) {
        setSaved({ id: result.id, number: result.number });
        setUncertain(false);
        return;
      }
      setUncertain((current) => current || !!result.unconfirmed);
      setError(
        result.error ??
          "No se pudo guardar el registro. Tus datos se conservan.",
      );
    } catch {
      setUncertain(true);
      setError(
        "No se pudo confirmar el guardado. Pulsa Terminar registro otra vez para comprobarlo sin duplicar candidatos.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (saved)
    return (
      <section className="panel wizard-success">
        <span className="wizard-success-icon">
          <Check size={38} aria-hidden="true" />
        </span>
        <h2>Candidato y plana registrados</h2>
        <p>
          <strong>{mayor.name}</strong> y el partido <strong>{party}</strong>{" "}
          quedaron registrados con su equipo de regiduría.
        </p>
        <span className="state-pill">
          Número asignado automáticamente: {saved.number}
        </span>
        <Link
          className="button primary"
          href={`/sistema/${election}/candidatos#candidato-${saved.id}`}
        >
          Mostrar candidatos
        </Link>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setSaved(null);
            setMayor(emptyStudent());
            setParty("");
            setProposals("");
            setPhoto(null);
            setSymbol(null);
            setConsent(false);
            setRegidors([emptyRegidor()]);
            setIndex(0);
            request.current = "";
            go(0);
          }}
        >
          Registrar otro candidato y su plana
        </button>
      </section>
    );
  return (
    <section className="panel slate-wizard" aria-busy={busy}>
      <ol className="wizard-progress" aria-label="Pasos del registro">
        {steps.map((label, n) => (
          <li
            key={label}
            className={n === step ? "current" : n < step ? "complete" : ""}
            aria-current={n === step ? "step" : undefined}
          >
            <span>
              {n < step ? <Check size={16} aria-hidden="true" /> : n + 1}
            </span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <div className="wizard-step-heading">
        <span className="eyebrow">
          {step < 4
            ? `PASO ${step + 1} DE 5`
            : `PLANA DE REGIDURÍA · REGIDOR ${index + 1}`}
        </span>
        <h2 ref={title} tabIndex={-1}>
          {
            [
              "Ingresa el nombre del candidato",
              "Ingresa el nombre del partido",
              "Sube la fotografía del candidato",
              "Sube el símbolo del partido",
              `Registra al regidor ${index + 1}`,
            ][step]
          }
        </h2>
        <p>
          {
            [
              "Registra al alcalde que representará a la agrupación escolar.",
              "El nombre y las propuestas identifican a tu agrupación en la elección.",
              "Esta fotografía aparecerá en la tarjeta del candidato.",
              "El símbolo se mostrará en la esquina de la tarjeta y junto al partido.",
              "Completa su nombre, cargo y aula. Puedes agregar más regidores o terminar el registro.",
            ][step]
          }
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <fieldset disabled={busy || uncertain} className="wizard-fields">
          {step === 0 && (
            <StudentFields
              value={mayor}
              onChange={setMayor}
              prefix="candidato"
            />
          )}
          {step === 1 && (
            <>
              <label>
                Nombre del partido o agrupación escolar
                <input
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  maxLength={120}
                />
              </label>
              <label>
                Propuestas del partido (una por línea)
                <textarea
                  value={proposals}
                  onChange={(e) => setProposals(e.target.value)}
                  rows={4}
                  maxLength={10000}
                />
              </label>
              <p>
                Las propuestas son necesarias para preparar la elección. El
                número del partido se asignará automáticamente al guardar.
              </p>
            </>
          )}
          {step === 2 && (
            <WizardImage
              label="Foto del candidato"
              file={photo}
              onChange={setPhoto}
            />
          )}
          {step === 3 && (
            <>
              <WizardImage
                label="Símbolo del partido"
                file={symbol}
                onChange={setSymbol}
              />
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Tengo autorización institucional para utilizar la foto y el
                símbolo.
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <StudentFields
                value={regidors[index]}
                onChange={(next) =>
                  updateRegidor({ ...regidors[index], ...next })
                }
                prefix="regidor"
              />
              <label>
                Cargo del regidor
                <input
                  value={regidors[index].title}
                  onChange={(e) =>
                    updateRegidor({ ...regidors[index], title: e.target.value })
                  }
                  maxLength={100}
                  placeholder="Por ejemplo: Regidor de Educación, Cultura y Deporte"
                />
              </label>
              <div className="wizard-team-summary">
                <UsersRound size={20} aria-hidden="true" />
                <span>
                  {
                    regidors.filter(
                      (r) => slateRegidorSchema.safeParse(r).success,
                    ).length
                  }{" "}
                  regidores completados · Puedes volver para revisar sus datos.
                </span>
              </div>
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <div className="wizard-actions">
          {(step > 0 || index > 0) && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || uncertain}
              onClick={() => {
                if (step === 4 && index > 0) {
                  setIndex(index - 1);
                  setError("");
                } else go(step - 1);
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Atrás
            </button>
          )}
          <button
            type="submit"
            className="button secondary"
            disabled={busy || uncertain || (step === 4 && index === 19)}
          >
            {step === 4 ? "Siguiente regidor" : "Siguiente"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {step === 4 && (
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void finish()}
            >
              <Save size={18} aria-hidden="true" />
              {busy ? "Guardando registro…" : "Terminar registro"}
            </button>
          )}
        </div>
      </form>
      <aside className="wizard-draft-note">
        <UserRound size={18} aria-hidden="true" />
        <span>{mayor.name || "Nombre del candidato pendiente"}</span>
        <Flag size={18} aria-hidden="true" />
        <span>{party || "Partido pendiente"}</span>
        <small>
          Los datos se guardan al pulsar Terminar registro. No cierres esta
          página antes de finalizar.
        </small>
      </aside>
    </section>
  );
}
