"use client";
import {
  useActionState,
  useState,
  type ReactNode,
  type FormEventHandler,
} from "react";
import {
  createElectionAction,
  electionStateAction,
  importRollAction,
  correctStudentAction,
  saveListAction,
  saveCandidateAction,
  uploadMediaAction,
  credentialAction,
  deliveryAction,
  voteAction,
  voteStatusAction,
  type OperationState,
} from "@/app/sistema/actions";
import type { ConnectedElection } from "@/lib/connected/policy";
import type { ConnectedElector, ConnectedList } from "@/lib/connected/data";
type Operation = (
  state: OperationState,
  form: FormData,
) => Promise<OperationState>;
function Notice({ state }: { state: OperationState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="notice">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      {state.mediaPath && (
        <p>
          Ruta privada: <code>{state.mediaPath}</code>
        </p>
      )}
    </>
  );
}
function OperationForm({
  operation,
  children,
  label,
  disabled = false,
  onReset,
}: {
  operation: Operation;
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onReset?: FormEventHandler<HTMLFormElement>;
}) {
  const [state, action, pending] = useActionState(
    operation,
    {} as OperationState,
  );
  return (
    <form action={action} onReset={onReset}>
      {children}
      <Notice state={state} />
      <button className="button primary" disabled={pending || disabled}>
        {pending ? "Procesando…" : label}
      </button>
    </form>
  );
}
export function ConnectedCreateElection({
  showDemonstrations = true,
  expected = 230,
  year = 2026,
  institutions = [],
}: {
  institutions?: { id: string; name: string; expected_students: number }[];
  showDemonstrations?: boolean;
  expected?: number;
  year?: number;
}) {
  const [selectedInstitution, setSelectedInstitution] = useState(
    institutions[0]?.id ?? "",
  );
  const selected = institutions.find((i) => i.id === selectedInstitution);
  return (
    <OperationForm
      operation={createElectionAction}
      label="Crear borrador"
      onReset={(event) => event.preventDefault()}
    >
      {showDemonstrations ? (
        <>
          <label htmlFor="election-purpose">Modalidad</label>
          <select id="election-purpose" name="purpose" defaultValue="official">
            <option value="official">
              Institucional · preparación oficial
            </option>
            <option value="test">Pruebas · solo datos ficticios</option>
          </select>
        </>
      ) : (
        <>
          <input type="hidden" name="purpose" value="official" />
          <input type="hidden" name="configured" value="yes" />
          <label>
            Institución educativa
            <input
              type="hidden"
              name="institution"
              value={selectedInstitution}
            />
            <select
              value={selectedInstitution}
              onChange={(event) => setSelectedInstitution(event.target.value)}
              required
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Total previsto de electores
            <input
              type="number"
              name="expected"
              key={selectedInstitution}
              defaultValue={selected?.expected_students ?? expected}
              min={1}
              max={10000}
              required
            />
          </label>
        </>
      )}
      <label className="blank-vote">
        <input type="checkbox" name="confirm" value="yes" required />
        Confirmo que crear el borrador no autoriza ni abre la votación.
      </label>
      <label htmlFor="election-year">Año electoral</label>
      <input
        id="election-year"
        type="number"
        name="year"
        min={2026}
        max={2100}
        defaultValue={year}
        required
      />
    </OperationForm>
  );
}
export function ConnectedElectionState({
  election,
  canOpen = false,
}: {
  election: ConnectedElection;
  canOpen?: boolean;
}) {
  if (election.state === "draft" && !canOpen)
    return (
      <p className="notice">
        Borrador en preparación. La apertura está bloqueada hasta completar la
        aprobación y habilitación correspondiente.
      </p>
    );
  if (election.state === "closed")
    return (
      <p className="notice">
        Elección cerrada. No se puede reabrir desde la aplicación.
      </p>
    );
  return (
    <OperationForm
      operation={electionStateAction.bind(null, election.id)}
      label={
        election.state === "draft"
          ? "Abrir elección en PostgreSQL"
          : "Cerrar elección en PostgreSQL"
      }
    >
      <input
        type="hidden"
        name="state"
        value={election.state === "draft" ? "open" : "closed"}
      />
      <label className="blank-vote">
        <input name="confirm" type="checkbox" value="yes" required /> Confirmo
        el cambio de estado y la revisión por el comité. No es una simulación.
      </label>
    </OperationForm>
  );
}
export function ConnectedImportRoll({
  election,
}: {
  election: ConnectedElection;
}) {
  const [mode, setMode] = useState("replace");
  return (
    <OperationForm
      onReset={(event) => {
        // Keep the selected import mode across successful Server Actions.
        event.preventDefault();
        event.currentTarget
          .querySelectorAll<HTMLInputElement>('input[type="file"]')
          .forEach((input) => {
            input.value = "";
          });
        event.currentTarget
          .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
          .forEach((input) => {
            input.checked = false;
          });
      }}
      operation={importRollAction.bind(null, election.id)}
      label={
        mode === "append"
          ? "Agregar grado al padrón mediante RPC"
          : "Reemplazar padrón mediante RPC"
      }
      disabled={election.state !== "draft"}
    >
      <p>
        Una hoja XLSX con {election.purpose === "official" ? "dni" : "codigo"},
        nombre, grado, seccion. El DNI debe estar en formato Texto y contener 8
        dígitos. Máximo {election.expected_students} filas y 2 MB.{" "}
        {election.purpose === "test"
          ? "Solo plantilla ficticia en modo pruebas."
          : "Padrón institucional: solo datos autorizados; no compartir archivos ni credenciales."}
      </p>
      <input type="hidden" name="mode" value={mode} />
      {election.purpose === "official" && (
        <label>
          Tipo de importación
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="replace">Reemplazar padrón completo</option>
            <option value="append">
              Agregar grado/sección sin borrar registros
            </option>
          </select>
        </label>
      )}
      <input
        aria-label="Excel para PostgreSQL"
        type="file"
        name="file"
        accept=".xlsx"
        required
        disabled={election.state !== "draft"}
      />
      <label className="blank-vote">
        <input type="checkbox" name="confirm" value="yes" required />{" "}
        {mode === "append"
          ? "Confirmo que se agregarán registros sin reemplazar los existentes."
          : "Confirmo el reemplazo completo y la revocación de credenciales previas."}
      </label>
    </OperationForm>
  );
}
export function ConnectedCorrectStudent({
  election,
  students,
}: {
  election: ConnectedElection;
  students: ConnectedElector[];
}) {
  const [selected, setSelected] = useState("");
  const student = students.find((s) => s.id === selected);
  return (
    <>
      <label htmlFor="select-student">Registro que se corregirá</label>
      <select
        id="select-student"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Seleccionar…</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} · {s.full_name}
          </option>
        ))}
      </select>
      {student && (
        <OperationForm
          key={student.id}
          operation={correctStudentAction.bind(null, election.id)}
          label="Guardar corrección y revocar credencial"
          disabled={election.state !== "draft"}
        >
          <input name="elector" type="hidden" value={student.id} />
          <label>
            {election.supervised_dni ? "DNI" : "Código"}
            <input
              name="code"
              required
              maxLength={election.supervised_dni ? 8 : 30}
              pattern={election.supervised_dni ? "[0-9]{8}" : undefined}
              defaultValue={student.code}
            />
          </label>
          <label>
            Nombre
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={student.full_name}
            />
          </label>
          <label>
            Grado
            <select name="grade" defaultValue={student.grade}>
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Sección
            <select name="section" defaultValue={student.section}>
              {["A", "B", "C"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {election.supervised_dni ? (
            <input type="hidden" name="authUser" value="" />
          ) : (
            <label>
              UUID de usuario creado manualmente en Supabase Auth
              <input
                name="authUser"
                defaultValue={student.auth_user_id ?? ""}
                placeholder="Vacío para dejar sin vincular"
                autoComplete="off"
              />
            </label>
          )}
        </OperationForm>
      )}
    </>
  );
}
export function ConnectedListEditor({
  election,
  lists,
}: {
  election: ConnectedElection;
  lists: ConnectedList[];
}) {
  const [id, setId] = useState("");
  const list = lists.find((l) => l.id === id);
  return (
    <>
      <label>
        Lista que se editará
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Nueva lista</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.number} · {l.name}
            </option>
          ))}
        </select>
      </label>
      <OperationForm
        key={id}
        operation={saveListAction.bind(null, election.id)}
        label="Guardar lista en PostgreSQL"
        disabled={election.state !== "draft"}
      >
        <input name="id" type="hidden" value={id} />
        <label>
          Nombre de lista
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={list?.name}
          />
        </label>
        <label>
          Número electoral
          <input
            name="number"
            type="number"
            min={1}
            max={99}
            required
            defaultValue={list?.number ?? 1}
          />
        </label>
        <label>
          Propuestas (una por línea)
          <textarea
            name="proposals"
            required
            defaultValue={list?.proposals.join("\n")}
          />
        </label>
        <label>
          Ruta privada del símbolo (opcional)
          <input
            name="symbol"
            defaultValue={list?.symbol_path ?? ""}
            placeholder="UUID-elección/UUID.webp"
          />
        </label>
      </OperationForm>
      {list && (
        <OperationForm
          operation={saveListAction.bind(null, election.id)}
          label="Eliminar lista y candidaturas"
          disabled={election.state !== "draft"}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="delete" value="yes" />
          <label className="blank-vote">
            <input type="checkbox" name="confirm" value="yes" required />{" "}
            Confirmo la eliminación de esta lista.
          </label>
        </OperationForm>
      )}
    </>
  );
}
export function ConnectedCandidateEditor({
  election,
  lists,
}: {
  election: ConnectedElection;
  lists: ConnectedList[];
}) {
  const [id, setId] = useState("");
  const candidates = lists.flatMap((l) =>
    l.candidates.map((c) => ({ ...c, list: l.id })),
  );
  const candidate = candidates.find((c) => c.id === id);
  return (
    <>
      <label>
        Candidatura
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Nueva candidatura</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.title}
            </option>
          ))}
        </select>
      </label>
      <OperationForm
        key={id}
        operation={saveCandidateAction.bind(null, election.id)}
        label="Guardar candidatura en PostgreSQL"
        disabled={election.state !== "draft" || !lists.length}
      >
        <input name="id" type="hidden" value={id} />
        <label>
          Lista
          <select
            aria-label="Lista de la candidatura"
            name="list"
            required
            defaultValue={candidate?.list}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={candidate?.name}
          />
        </label>
        <label>
          Tipo
          <select name="role" defaultValue={candidate?.role ?? "alcalde"}>
            <option value="alcalde">Alcalde escolar</option>
            <option value="regidor">Regidor</option>
          </select>
        </label>
        <label>
          Posición (0 para alcalde; 1–20 para regidores)
          <input
            type="number"
            name="position"
            min={0}
            max={20}
            defaultValue={candidate?.position ?? 0}
          />
        </label>
        <label>
          Cargo
          <input
            name="title"
            required
            maxLength={100}
            defaultValue={candidate?.title}
          />
        </label>
        <label>
          Grado
          <select name="grade" defaultValue={candidate?.grade ?? 1}>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Sección
          <select name="section" defaultValue={candidate?.section ?? "A"}>
            {["A", "B", "C"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Ruta privada de fotografía (opcional)
          <input name="photo" defaultValue={candidate?.photo_path ?? ""} />
        </label>
      </OperationForm>
      {candidate && (
        <OperationForm
          operation={saveCandidateAction.bind(null, election.id)}
          label="Eliminar candidatura"
          disabled={election.state !== "draft"}
        >
          {Object.entries({
            id: candidate.id,
            list: candidate.list,
            name: candidate.name,
            role: candidate.role,
            position: String(candidate.position),
            title: candidate.title,
            grade: String(candidate.grade),
            section: candidate.section,
            delete: "yes",
          }).map(([name, val]) => (
            <input key={name} type="hidden" name={name} value={val} />
          ))}
          <label className="blank-vote">
            <input type="checkbox" name="confirm" value="yes" required />{" "}
            Confirmo eliminar esta candidatura.
          </label>
        </OperationForm>
      )}
    </>
  );
}
export function ConnectedMediaUpload({
  election,
}: {
  election: ConnectedElection;
}) {
  return (
    <OperationForm
      operation={uploadMediaAction.bind(null, election.id)}
      label="Sanear y subir imagen privada"
      disabled={election.state !== "draft"}
    >
      <p>
        JPEG, PNG o WebP de hasta 5 MB. Se eliminan metadatos y se utiliza un
        nombre opaco. Carga únicamente fotografías con autorización
        institucional documentada.
      </p>
      <input
        aria-label="Fotografía autorizada"
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />
      <label className="blank-vote">
        <input type="checkbox" name="consent" value="yes" required /> Confirmo
        que existe autorización documentada para este medio.
      </label>
    </OperationForm>
  );
}
export function ConnectedCredentials({
  election,
  students,
}: {
  election: ConnectedElection;
  students: ConnectedElector[];
}) {
  const [state, setState] = useState<OperationState>({});
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p>
        Entrega individual: muestra el token únicamente al destinatario
        verificado. La reemisión invalida el anterior. No lo copies a logs, URL,
        capturas o archivos generales.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setState({});
          const form = new FormData(e.currentTarget);
          try {
            setState(await credentialAction(election.id, {}, form));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Elector
          <select name="elector" disabled={busy}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="blank-vote">
          <input
            type="checkbox"
            name="supervised"
            value="yes"
            required
            disabled={busy}
          />{" "}
          He verificado al destinatario y supervisaré su entrega individual.
        </label>
        <button
          className="button primary"
          disabled={busy || election.state === "closed" || !students.length}
        >
          Emitir o recuperar credencial
        </button>
      </form>
      <Notice state={state} />
      {state.token && (
        <div className="credential-reveal">
          <p>Token individual · expira {state.expiresAt}</p>
          <input
            aria-label="Token individual de entrega"
            readOnly
            value={state.token}
            autoComplete="off"
            spellCheck={false}
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const form = new FormData(e.currentTarget);
              try {
                const result = await deliveryAction(election.id, {}, form);
                if (result.error)
                  setState((s) => ({ ...s, error: result.error }));
                else setState(result);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input type="hidden" name="elector" value={state.elector} />
            <input type="hidden" name="version" value={state.version} />
            <label className="blank-vote">
              <input type="checkbox" name="confirm" value="yes" required />{" "}
              Confirmo la entrega al elector correcto.
            </label>
            <button className="button primary" disabled={busy}>
              Confirmar entrega y retirar token
            </button>
          </form>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              setState({
                message:
                  "Token retirado sin confirmar entrega. La credencial sigue bloqueada hasta una nueva emisión supervisada.",
              })
            }
          >
            Cancelar y ocultar token
          </button>
        </div>
      )}
    </>
  );
}
export function ConnectedVote({
  election,
  lists,
  allowed,
  participated,
}: {
  election: ConnectedElection;
  lists: ConnectedList[];
  allowed: boolean;
  participated: boolean;
}) {
  const [choice, setChoice] = useState("");
  const [token, setToken] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<OperationState>({});
  const registered = participated || state.outcome === "registered";
  const unresolved = state.outcome === "unknown";
  return (
    <>
      <div className="notice">
        {allowed
          ? "La solicitud se registrará en PostgreSQL mediante la RPC transaccional."
          : "Emisión RPC deshabilitada. No se enviará ninguna selección."}{" "}
        La cuenta autenticada determina el elector; no se envía un identificador
        de estudiante junto a la selección.
      </div>
      {registered ? (
        <p role="status">
          Participación registrada. No se muestra el contenido de la papeleta.
        </p>
      ) : allowed && !review && !unresolved ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setReview(true);
          }}
        >
          <fieldset>
            <legend>Selecciona una lista</legend>
            {lists.map((l) => (
              <label className="blank-vote" key={l.id}>
                <input
                  type="radio"
                  name="choice"
                  value={l.id}
                  checked={choice === l.id}
                  onChange={() => setChoice(l.id)}
                  required
                />{" "}
                Lista {l.number} · {l.name}
              </label>
            ))}
            <label className="blank-vote">
              <input
                type="radio"
                name="choice"
                value="blank"
                checked={choice === "blank"}
                onChange={() => setChoice("blank")}
              />{" "}
              Voto en blanco
            </label>
          </fieldset>
          <label htmlFor="vote-token">Credencial electoral individual</label>
          <input
            id="vote-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            minLength={43}
            maxLength={43}
            required
          />
          <button className="button primary">Revisar antes de emitir</button>
        </form>
      ) : allowed && review ? (
        <section className="vote-review">
          <h2>Confirma tu selección</h2>
          <p>
            {choice === "blank"
              ? "Voto en blanco"
              : lists.find((l) => l.id === choice)?.name}
          </p>
          <div className="roll-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              Volver a elegir
            </button>
            <button
              className="button primary"
              disabled={busy || unresolved || registered}
              onClick={async () => {
                setBusy(true);
                const form = new FormData();
                form.set("choice", choice);
                form.set("token", token);
                form.set("confirm", "yes");
                try {
                  const result = await voteAction(election.id, {}, form);
                  setState(result);
                  setToken("");
                  setChoice("");
                  setReview(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar y emitir solicitud RPC
            </button>
          </div>
        </section>
      ) : null}
      <Notice state={state} />
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setState(await voteStatusAction(election.id));
          } finally {
            setBusy(false);
          }
        }}
      >
        Consultar mi participación sin votar
      </button>
    </>
  );
}
