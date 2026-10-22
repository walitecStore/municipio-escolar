"use server";
import { revalidatePath } from "next/cache";
import { mutationOrigin, protectedElection } from "@/lib/connected/session";
import {
  slateRegistrationSchema,
  slateReceiptSchema,
} from "@/lib/connected/slate-registration";
import { preparePrivateElectoralImage } from "@/lib/electoral/media";
export type SlateWizardResult = {
  error?: string;
  id?: string;
  number?: number;
  unconfirmed?: boolean;
};
export async function registerSlateAction(
  id: string,
  form: FormData,
): Promise<SlateWizardResult> {
  let stage = "access";
  try {
    await mutationOrigin();
    const { client, election } = await protectedElection(id, true);
    const raw = String(form.get("payload") ?? "");
    if (raw.length > 40000)
      return { error: "El registro supera el tamaño permitido." };
    const parsed = slateRegistrationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const input = parsed.data;
    const saved = await client.rpc("get_slate_registration_receipt", {
      p_election: id,
      p_request: input.request,
    });
    if (saved.error)
      return {
        error:
          "El registro guiado necesita la actualización de base de datos 010. Contacta al responsable; tus datos siguen en esta pantalla.",
      };
    if (saved.data) {
      const receipt = slateReceiptSchema.parse(saved.data);
      return receipt.deleted
        ? {
            error:
              "Este registro ya fue eliminado. Inicia uno nuevo para volver a registrarlo.",
          }
        : { id: receipt.id, number: receipt.number };
    }
    if (election.state !== "draft")
      return {
        error: "La elección debe estar en borrador para registrar candidatos.",
      };
    const photo = form.get("photo"),
      symbol = form.get("symbol");
    for (const file of [photo, symbol])
      if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024)
        return {
          error:
            "Selecciona foto y símbolo en JPG, PNG o WebP de hasta 3 MB cada uno.",
        };
    if ((photo as File).size + (symbol as File).size > 4 * 1024 * 1024)
      return {
        error: "La foto y el símbolo juntos deben ocupar como máximo 4 MB.",
      };
    if (form.get("consent") !== "yes")
      return {
        error: "Confirma la autorización para utilizar ambas imágenes.",
      };
    stage = "images";
    // Validate/sanitize BOTH files before the first Storage upload.
    const images = await Promise.all(
      [photo, symbol].map((file) =>
        (file as File)
          .arrayBuffer()
          .then((bytes) =>
            preparePrivateElectoralImage(new Uint8Array(bytes), id),
          ),
      ),
    );
    for (const image of images) {
      const auth = await client.rpc("register_electoral_media", {
        p_election: id,
        p_path: image.path,
        p_consent: true,
      });
      if (auth.error) throw new Error();
      const upload = await client.storage
        .from("electoral-media")
        .upload(image.path, image.bytes, {
          contentType: image.contentType,
          cacheControl: "0",
          upsert: false,
        });
      if (upload.error) throw new Error();
    }
    stage = "save";
    const result = await client.rpc("register_electoral_slate", {
      p_election: id,
      p_request: input.request,
      p_party: input.party,
      p_proposals: input.proposals,
      p_symbol: images[1].path,
      p_mayor: { ...input.mayor, photo: images[0].path },
      p_regidors: input.regidors,
    });
    if (result.error) {
      // A response may be lost after commit: check the receipt, never repeat the insert here.
      const confirmation = await client.rpc("get_slate_registration_receipt", {
        p_election: id,
        p_request: input.request,
      });
      const receipt = slateReceiptSchema.safeParse(confirmation.data);
      if (!confirmation.error && receipt.success && !receipt.data.deleted) {
        revalidatePath(`/sistema/${id}`);
        return { id: receipt.data.id, number: receipt.data.number };
      }
      if (!confirmation.error && confirmation.data === null)
        return {
          error:
            "No se guardó el registro. Comprueba que la elección siga en borrador e inténtalo de nuevo. No se creó una plana incompleta.",
        };
      return {
        unconfirmed: true,
        error:
          "No se pudo confirmar el guardado. Mantén esta pantalla y pulsa Terminar registro de nuevo: comprobaremos si ya se guardó para evitar duplicados.",
      };
    }
    const receipt = slateReceiptSchema.parse(result.data);
    if (receipt.deleted)
      return {
        error: "La inscripción ya se eliminó. Inicia un registro nuevo.",
      };
    revalidatePath(`/sistema/${id}`);
    return { id: receipt.id, number: receipt.number };
  } catch {
    return {
      unconfirmed: stage === "save",
      error:
        stage === "images"
          ? "No se pudieron guardar las imágenes. Comprueba su formato, tamaño y conexión; tus datos se conservan."
          : stage === "save"
            ? "No se pudo confirmar el guardado. Pulsa Terminar registro de nuevo para comprobarlo sin duplicar candidatos."
            : "No se pudo comprobar tu acceso. Revisa tu sesión y la verificación de seguridad. Tus datos siguen en esta pantalla.",
    };
  }
}
