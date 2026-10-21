"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { mutationOrigin } from "@/lib/connected/session";
import { supabaseServer } from "@/lib/connected/client";
import {
  stationCookie,
  stationRpc,
  type StationState,
} from "@/lib/connected/station";
export async function boothAction(
  _: StationState,
  form: FormData,
): Promise<StationState> {
  try {
    const config = await mutationOrigin();
    const { data } = await (await supabaseServer()).auth.getUser();
    if (data.user)
      return {
        state: "ready",
        error:
          "Usa otro navegador o un perfil exclusivo para votar, sin sesión administrativa.",
      };
    const operation = String(form.get("operation") ?? "");
    if (operation === "connect") {
      const token = z
        .string()
        .regex(/^[A-Za-z0-9_-]{64}$/)
        .parse(form.get("station"));
      (await cookies()).set(stationCookie, token, {
        httpOnly: true,
        secure: config.origin.startsWith("https:"),
        sameSite: "strict",
        path: "/sistema/mesa",
        maxAge: 8 * 60 * 60,
      });
      return { state: "ready" };
    }
    if (!["request", "status", "cast", "finish"].includes(operation))
      throw new Error();
    // Check the election's modality before *any* mutation, especially casting.
    const status = await stationRpc("status");
    if (operation === "status") return status;
    if (operation === "cast" && form.get("confirm") !== "yes")
      return { ...status, error: "Confirma tu elección antes de votar." };
    const dni =
      operation === "request"
        ? z
            .string()
            .regex(/^\d{8}$/)
            .parse(form.get("dni"))
        : null;
    const choice =
      operation === "cast" && form.get("choice") !== "blank"
        ? z.string().uuid().parse(form.get("choice"))
        : null;
    return await stationRpc(operation, dni, choice);
  } catch {
    return {
      state: "ready",
      error:
        "Operación no disponible. Consulta al comité. Si ya confirmaste un voto, comprueba su estado antes de intentar otra vez.",
    };
  }
}
