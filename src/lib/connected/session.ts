import "server-only";
import { demonstrationsEnabled } from "@/lib/platform";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "./client";
import { integrationConfig } from "./env";
import {
  electionSchema,
  sessionSchema,
  isStaff,
  isSameOrigin,
  uuid,
} from "./policy";
import type { AuthorizedRpc } from "../electoral/backend";
export async function verifiedSession() {
  const client = await supabaseServer();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/sistema/login");
  const context = await client.rpc("get_electoral_session");
  if (context.error)
    throw new Error(
      "No se pudo verificar el acceso. Comprueba las migraciones y permisos.",
    );
  const session = sessionSchema.parse(context.data);
  if (session.role === "unassigned")
    throw new Error("Cuenta sin autorización electoral.");
  return { client, session, userId: data.user.id };
}
export async function protectedElection(id: string, staff = false) {
  if (!uuid.safeParse(id).success)
    throw new Error("Identificador de elección inválido.");
  const access = await verifiedSession();
  if (
    ["administrator", "committee"].includes(access.session.role) &&
    access.session.aal !== "aal2"
  )
    redirect("/sistema/mfa");
  if (staff && !isStaff(access.session))
    throw new Error("Acceso restringido al personal autorizado.");
  const response = await access.client.rpc("list_accessible_elections");
  if (response.error)
    throw new Error("No se pudieron consultar las elecciones.");
  const elections = z.array(electionSchema).parse(response.data);
  const election = elections.find((e) => e.id === id);
  if (election?.purpose === "test" && !demonstrationsEnabled())
    throw new Error("Elección no disponible para este acceso.");
  if (!election) throw new Error("Elección no disponible para esta cuenta.");
  return { ...access, election };
}
export async function mutationOrigin() {
  const config = integrationConfig();
  if (!config || !isSameOrigin((await headers()).get("origin"), config.origin))
    throw new Error("Origen no autorizado.");
  return config;
}
export function sessionRpc(
  client: Awaited<ReturnType<typeof supabaseServer>>,
): AuthorizedRpc {
  return {
    async call<T>(name: string, args: Record<string, unknown>) {
      const { data, error } = await client.rpc(name, args);
      if (error)
        throw Object.assign(new Error("Operación electoral rechazada."), {
          code: error.code,
        });
      return data as T;
    },
  };
}
