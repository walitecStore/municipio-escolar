"use server";
import { demonstrationsEnabled } from "@/lib/platform";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  mutationOrigin,
  protectedElection,
  verifiedSession,
  sessionRpc,
} from "@/lib/connected/session";
import {
  uuid,
  isStaff,
  votingAllowed,
  openingAllowed,
} from "@/lib/connected/policy";
import { validateRows, isDemoOnly } from "@/lib/roll/model";
import {
  readRollExcel,
  MAX_FILE_BYTES,
  RollImportError,
} from "@/lib/roll/excel";
import {
  issueCredential,
  confirmCredentialDelivery,
  submitVote,
} from "@/lib/electoral/backend";
import {
  candidateRegistrationSchema,
  candidateConflict,
} from "@/lib/connected/candidate-registration";
import { listsSchema } from "@/lib/connected/data";
import { preparePrivateElectoralImage } from "@/lib/electoral/media";
export type OperationState = {
  error?: string;
  message?: string;
  token?: string;
  version?: string;
  expiresAt?: string;
  elector?: string;
  mediaPath?: string;
  outcome?: string;
};
const fail = (): OperationState => ({
  error:
    "Operación rechazada. Comprueba sesión, permisos, campos y estado de la elección.",
});
const value = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const optionalId = (s: string) => (s === "" ? null : uuid.parse(s));
function mediaPath(election: string, path: string) {
  if (!path) return null;
  if (
    !new RegExp(`^${election}/[A-Za-z0-9_-]+\\.(jpg|jpeg|png|webp)$`).test(
      path,
    ) ||
    path.length > 180
  )
    throw new Error("Medio inválido.");
  return path;
}
async function staffAccess(
  id: string,
  draft = false,
  allowOfficialClose = false,
) {
  const config = await mutationOrigin();
  const access = await protectedElection(id, true);
  if (
    access.election.purpose === "official" &&
    access.election.state !== "draft" &&
    !config.official &&
    !allowOfficialClose
  )
    throw new Error("Operación oficial deshabilitada.");
  if (draft && access.election.state !== "draft")
    throw new Error("Solo editable en borrador.");
  return { ...access, config, rpc: sessionRpc(access.client) };
}
export async function createElectionAction(
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  let id = "";
  try {
    await mutationOrigin();
    const access = await verifiedSession();
    if (!isStaff(access.session)) return fail();
    const year = z.coerce
      .number()
      .int()
      .min(2026)
      .max(2100)
      .parse(value(form, "year"));
    const purpose = z
      .enum(["test", "official"])
      .parse(value(form, "purpose") || "official");
    if (purpose === "test" && !demonstrationsEnabled()) return fail();
    if (purpose === "official" && form.get("confirm") !== "yes")
      return {
        error:
          "Confirma la creación del borrador institucional sin abrir la votación.",
      };
    const configured = form.get("configured") === "yes";
    const result =
      configured && purpose === "official"
        ? await access.client.rpc("create_institution_election", {
            p_institution: uuid.parse(value(form, "institution")),
            p_year: year,
            p_expected: z.coerce
              .number()
              .int()
              .min(1)
              .max(10000)
              .parse(value(form, "expected")),
          })
        : purpose === "official"
          ? await access.client.rpc("create_institutional_election", {
              p_year: year,
            })
          : await access.client.rpc("manage_electoral_election", {
              p_id: null,
              p_year: year,
              p_state: "draft",
            });
    if (
      purpose === "official" &&
      ["PGRST202", "42883"].includes(result.error?.code ?? "")
    )
      return {
        error: configured
          ? "La configuración institucional requiere las migraciones 007 y 008. No repitas las migraciones anteriores."
          : "La preparación institucional requiere la migración adicional 005. Consulta la guía de gestión institucional; no repitas 001–004.",
      };
    if (result.error?.code === "23505")
      return {
        error:
          "Ya existe una elección de ese año y modalidad. Utiliza el borrador existente.",
      };
    if (result.error || !uuid.safeParse(result.data).success) return fail();
    id = result.data;
  } catch {
    return fail();
  }
  redirect(`/sistema/${id}`);
}
export async function electionStateAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const next = z.enum(["open", "closed"]).parse(value(form, "state"));
    const access = await staffAccess(id, false, next === "closed");
    if (form.get("confirm") !== "yes")
      return { error: "Confirma explícitamente el cambio de estado." };
    if (next === "open" && !openingAllowed(access.config, access.election))
      return fail();
    if (next === "closed" && access.election.state !== "open") return fail();
    await access.rpc.call("manage_electoral_election", {
      p_id: id,
      p_year: access.election.year,
      p_state: next,
    });
    revalidatePath(`/sistema/${id}`);
    return { message: "Estado de la elección actualizado." };
  } catch {
    return fail();
  }
}
export async function importRollAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const access = await staffAccess(id, true);
    if (form.get("confirm") !== "yes")
      return { error: "Confirma el reemplazo completo del padrón." };
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > MAX_FILE_BYTES ||
      !file.name.toLowerCase().endsWith(".xlsx")
    )
      return { error: "Selecciona un XLSX de hasta 2 MB." };
    const result = await readRollExcel(await file.arrayBuffer(), {
      allowDni: access.election.purpose === "official",
      maxRows: access.election.expected_students,
    });
    if (result.errors.length)
      return {
        error:
          "Archivo inválido: revisa códigos únicos, encabezados, grados y secciones. No se importó ninguna fila.",
      };
    if (access.election.purpose === "test" && !isDemoOnly(result.students))
      return {
        error:
          "El entorno de pruebas solo admite la plantilla ficticia DEMO-NNN.",
      };
    const append = form.get("mode") === "append";
    if (append && access.election.purpose !== "official")
      return {
        error:
          "La importación por grado requiere un padrón institucional con DNI.",
      };
    await access.rpc.call(
      append ? "append_electoral_dni_roll" : "replace_electoral_roll",
      {
        p_election: id,
        p_rows: result.students.map((s) => ({
          codigo: s.code,
          nombre: s.name,
          grado: s.grade,
          seccion: s.section,
        })),
      },
    );
    revalidatePath(`/sistema/${id}/padron`);
    return {
      message: append
        ? `Agregados ${result.students.length} registros sin reemplazar los grados existentes. Los duplicados se rechazan de forma transaccional.`
        : `Importados ${result.students.length} registros en una transacción. En modalidad individual vincula las cuentas Auth; para DNI presencial usa Mesas · DNI. Las credenciales anteriores fueron revocadas.`,
    };
  } catch (error) {
    if (error instanceof RollImportError) return { error: error.message };
    return fail();
  }
}
export async function correctStudentAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const access = await staffAccess(id, true);
    const elector = uuid.parse(value(form, "elector"));
    const result = validateRows([
      [
        value(form, "code"),
        value(form, "name"),
        value(form, "grade"),
        value(form, "section"),
      ],
    ]);
    if (
      result.errors.length ||
      (access.election.purpose === "test" && !isDemoOnly(result.students))
    )
      return fail();
    const s = result.students[0];
    await access.rpc.call("correct_electoral_student", {
      p_election: id,
      p_id: elector,
      p_code: s.code,
      p_name: s.name,
      p_grade: s.grade,
      p_section: s.section,
      p_auth_user: optionalId(value(form, "authUser")),
    });
    revalidatePath(`/sistema/${id}/padron`);
    return {
      message:
        "Registro corregido. La credencial anterior fue revocada; deberá emitirse y entregarse de nuevo.",
    };
  } catch {
    return fail();
  }
}
async function formImage(
  access: Awaited<ReturnType<typeof staffAccess>>,
  id: string,
  form: FormData,
  field: string,
  existing: string,
) {
  const saved = String(form.get(`${field}Saved`) ?? "");
  if (saved) {
    const path = mediaPath(id, saved);
    if (!path) throw new Error("Imagen no disponible");
    const stored = await access.client.storage.from("electoral-media").download(path);
    if (stored.error || !stored.data) throw new Error("Imagen no disponible");
    return path;
  }
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0)
    return mediaPath(id, existing);
  if (file.size > 5 * 1024 * 1024 || form.get(`${field}Consent`) !== "yes")
    throw new Error("Imagen sin autorización o demasiado grande.");
  const image = await preparePrivateElectoralImage(
    new Uint8Array(await file.arrayBuffer()),
    id,
  );
  await access.rpc.call("register_electoral_media", {
    p_election: id,
    p_path: image.path,
    p_consent: true,
  });
  const upload = await access.client.storage
    .from("electoral-media")
    .upload(image.path, image.bytes, {
      contentType: image.contentType,
      upsert: false,
      cacheControl: "0",
    });
  if (upload.error) throw new Error("No se pudo subir la imagen.");
  return image.path;
}
export async function saveListAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const access = await staffAccess(id, true);
    const deleting = form.get("delete") === "yes";
    if (deleting && form.get("confirm") !== "yes") return fail();
    const name = deleting
      ? ""
      : z.string().min(1).max(120).parse(value(form, "name"));
    const number = deleting
      ? 1
      : z.coerce.number().int().min(1).max(99).parse(value(form, "number"));
    const proposals = deleting
      ? []
      : z
          .array(z.string().trim().min(1).max(500))
          .min(1)
          .max(20)
          .parse(value(form, "proposals").split("\n"));
    await access.rpc.call("manage_electoral_list", {
      p_election: id,
      p_id: optionalId(value(form, "id")),
      p_name: name,
      p_number: number,
      p_proposals: proposals,
      p_symbol: deleting
        ? null
        : await formImage(
            access,
            id,
            form,
            "symbolFile",
            value(form, "symbol"),
          ),
      p_delete: deleting,
    });
    revalidatePath(`/sistema/${id}/listas`);
    return {
      message: deleting
        ? "Lista eliminada."
        : "Lista registrada. El símbolo seleccionado se guardó con la lista.",
    };
  } catch {
    return fail();
  }
}
export async function saveCandidateAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  let stage: "access" | "image" | "save" = "access";
  try {
    const access = await staffAccess(id);
    if (access.election.state !== "draft")
      return {
        error:
          "Solo puedes registrar o editar candidatos mientras la elección esté en borrador.",
      };
    const deleting = form.get("delete") === "yes";
    if (deleting && form.get("confirm") !== "yes")
      return { error: "Confirma la eliminación del candidato." };
    const parsed = candidateRegistrationSchema.safeParse({
      ...Object.fromEntries(
        ["id", "list", "name", "role", "title", "grade", "section"].map((k) => [
          k,
          value(form, k),
        ]),
      ),
      position: value(form, "role") === "alcalde" ? 0 : 1,
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const c = parsed.data;
    const response = await access.client.rpc("get_electoral_lists", {
      p_election: id,
    });
    if (response.error)
      return {
        error:
          "No se pudieron comprobar las listas. Actualiza la página e inténtalo de nuevo.",
      };
    const lists = listsSchema.parse(response.data);
    const list = lists.find((l) => l.id === c.list);
    if (!list)
      return {
        error:
          "La lista seleccionada ya no está disponible en esta elección. Actualiza la página y selecciona una lista registrada.",
      };
    if (
      c.id &&
      !lists.some((l) => l.candidates.some((existing) => existing.id === c.id))
    )
      return {
        error:
          "Ese candidato ya no está disponible. Actualiza la página antes de continuar.",
      };
    if (!deleting) {
      const current = list.candidates.find((existing) => existing.id === c.id);
      if (c.role === "alcalde") c.position = 0;
      else if (current?.role === "regidor") c.position = current.position;
      else {
        const used = new Set(
          list.candidates
            .filter((existing) => existing.id !== c.id)
            .map((existing) => existing.position),
        );
        const free = Array.from({ length: 20 }, (_, i) => i + 1).find(
          (n) => !used.has(n),
        );
        if (!free)
          return {
            error:
              "Esta lista ya tiene el máximo de regidores. Edita un candidato existente si necesitas corregir sus datos.",
          };
        c.position = free;
      }
      const conflict = candidateConflict(list, c);
      if (conflict) return { error: conflict };
    }
    stage = "image";
    const photo = deleting
      ? null
      : await formImage(access, id, form, "photoFile", value(form, "photo"));
    stage = "save";
    await access.rpc.call("manage_electoral_candidate", {
      p_election: id,
      p_id: optionalId(c.id),
      p_list: c.list,
      p_name: c.name,
      p_role: c.role,
      p_position: c.position,
      p_title: c.title,
      p_grade: c.grade,
      p_section: c.section,
      p_photo: photo,
      p_delete: deleting,
    });
    revalidatePath(`/sistema/${id}/listas`);
    return {
      message: deleting
        ? "Candidatura eliminada."
        : "Candidato registrado correctamente.",
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "23505")
      return {
        error:
          "Otro integrante acaba de registrarse en esta lista. Vuelve a pulsar Registrar candidato para actualizar la asignación automática; no se guardó un duplicado.",
      };
    if (stage === "image")
      return {
        error:
          "No se pudo guardar la fotografía. Usa JPG, PNG o WebP de hasta 5 MB y confirma la autorización. También puedes registrar al candidato sin foto.",
      };
    return {
      error:
        stage === "access"
          ? "No se pudo comprobar tu acceso. Revisa tu sesión y la verificación de seguridad antes de intentarlo de nuevo."
          : "No se pudo guardar el candidato. Comprueba que la elección siga en borrador y actualiza la página. Si continúa, consulta al administrador.",
    };
  }
}
export async function credentialAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const access = await staffAccess(id);
    if (form.get("supervised") !== "yes")
      return {
        error:
          "Verifica individualmente al destinatario y confirma la supervisión.",
      };
    const elector = uuid.parse(value(form, "elector"));
    const result = await issueCredential(access.rpc, id, elector);
    return {
      message:
        "Entrega individual pendiente de confirmar. El token anterior ya no es válido.",
      token: result.token,
      version: result.version,
      expiresAt: result.expiresAt.toISOString(),
      elector,
    };
  } catch {
    return fail();
  }
}
export async function deliveryAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const access = await staffAccess(id);
    if (form.get("confirm") !== "yes") return fail();
    await confirmCredentialDelivery(
      access.rpc,
      id,
      uuid.parse(value(form, "elector")),
      uuid.parse(value(form, "version")),
    );
    return { message: "Entrega confirmada. El token se retiró de la vista." };
  } catch {
    return fail();
  }
}
export async function voteAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const config = await mutationOrigin();
    const access = await protectedElection(id);
    if (!votingAllowed(config, access.election))
      return {
        error:
          "La votación no está disponible. La elección debe estar abierta y autorizada.",
      };
    if (form.get("confirm") !== "yes")
      return { error: "Confirma tu selección antes de emitir la solicitud." };
    const token = z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .parse(value(form, "token"));
    const choice =
      value(form, "choice") === "blank"
        ? null
        : uuid.parse(value(form, "choice"));
    const outcome = await submitVote(
      sessionRpc(access.client),
      id,
      token,
      choice,
    );
    return {
      outcome,
      message:
        outcome === "registered"
          ? "Existe una participación registrada. No se devuelve ni confirma el contenido de la papeleta."
          : outcome === "unknown"
            ? "Estado desconocido. Consulta tu participación antes de intentar otra solicitud."
            : outcome === "retryable"
              ? "Fallo transitorio sin participación confirmada. Revisa el estado antes de reintentar."
              : "Solicitud rechazada. Revisa la credencial, entrega y estado de la elección.",
    };
  } catch {
    return fail();
  }
}
export async function voteStatusAction(id: string): Promise<OperationState> {
  try {
    await mutationOrigin();
    const access = await protectedElection(id);
    const participated = await sessionRpc(access.client).call<boolean>(
      "electoral_vote_status",
      { p_election: id },
    );
    return {
      outcome: participated ? "registered" : "pending",
      message: participated
        ? "Participación registrada; no se revela el contenido del voto."
        : "No aparece una participación registrada. No se envió ningún voto.",
    };
  } catch {
    return fail();
  }
}
export async function uploadMediaAction(
  id: string,
  _: OperationState,
  form: FormData,
): Promise<OperationState> {
  try {
    const access = await staffAccess(id, true);
    if (form.get("consent") !== "yes")
      return {
        error:
          "Se requiere autorización documentada para la fotografía o símbolo.",
      };
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024) return fail();
    const image = await preparePrivateElectoralImage(
      new Uint8Array(await file.arrayBuffer()),
      id,
    );
    await access.rpc.call("register_electoral_media", {
      p_election: id,
      p_path: image.path,
      p_consent: true,
    });
    const uploaded = await access.client.storage
      .from("electoral-media")
      .upload(image.path, image.bytes, {
        contentType: image.contentType,
        upsert: false,
        cacheControl: "0",
      });
    if (uploaded.error)
      return {
        error:
          "No se pudo subir el archivo. No se vinculó ninguna fotografía a una candidatura.",
      };
    revalidatePath(`/sistema/${id}/media`);
    return {
      message:
        "Imagen guardada en la biblioteca privada. Ya puedes elegirla al registrar candidatos.",
      mediaPath: image.path,
    };
  } catch {
    return fail();
  }
}
