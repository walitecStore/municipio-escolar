"use server";
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
import { readRollExcel, MAX_FILE_BYTES } from "@/lib/roll/excel";
import {
  issueCredential,
  confirmCredentialDelivery,
  submitVote,
} from "@/lib/electoral/backend";
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
    const result = await access.client.rpc("manage_electoral_election", {
      p_id: null,
      p_year: year,
      p_state: "draft",
    });
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
    return { message: "Estado actualizado en PostgreSQL." };
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
    const result = await readRollExcel(await file.arrayBuffer());
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
    await access.rpc.call("replace_electoral_roll", {
      p_election: id,
      p_rows: result.students.map((s) => ({
        codigo: s.code,
        nombre: s.name,
        grado: s.grade,
        seccion: s.section,
      })),
    });
    revalidatePath(`/sistema/${id}/padron`);
    return {
      message: `Importados ${result.students.length} registros en una transacción. Vincula cada cuenta Auth; las credenciales anteriores fueron revocadas.`,
    };
  } catch {
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
      p_symbol: mediaPath(id, value(form, "symbol")),
      p_delete: deleting,
    });
    revalidatePath(`/sistema/${id}/listas`);
    return {
      message: deleting ? "Lista eliminada." : "Lista guardada en PostgreSQL.",
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
  try {
    const access = await staffAccess(id, true);
    const deleting = form.get("delete") === "yes";
    if (deleting && form.get("confirm") !== "yes") return fail();
    const role = z.enum(["alcalde", "regidor"]).parse(value(form, "role"));
    const position = z.coerce
      .number()
      .int()
      .min(0)
      .max(20)
      .parse(value(form, "position"));
    if (
      !deleting &&
      ((role === "alcalde" && position !== 0) ||
        (role === "regidor" && position === 0))
    )
      return fail();
    await access.rpc.call("manage_electoral_candidate", {
      p_election: id,
      p_id: optionalId(value(form, "id")),
      p_list: uuid.parse(value(form, "list")),
      p_name: z.string().min(1).max(120).parse(value(form, "name")),
      p_role: role,
      p_position: position,
      p_title: z.string().min(1).max(100).parse(value(form, "title")),
      p_grade: z.coerce
        .number()
        .int()
        .min(1)
        .max(5)
        .parse(value(form, "grade")),
      p_section: z.enum(["A", "B", "C"]).parse(value(form, "section")),
      p_photo: mediaPath(id, value(form, "photo")),
      p_delete: deleting,
    });
    revalidatePath(`/sistema/${id}/listas`);
    return {
      message: deleting
        ? "Candidatura eliminada."
        : "Candidatura guardada en PostgreSQL.",
    };
  } catch {
    return fail();
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
          "La emisión RPC está deshabilitada o la elección no está abierta y aprobada.",
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
    return {
      message:
        "Imagen saneada y guardada en el bucket privado. Usa la ruta opaca en la lista o candidatura.",
      mediaPath: image.path,
    };
  } catch {
    return fail();
  }
}
