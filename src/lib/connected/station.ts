import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import { presentationSchema } from "./presentation";
import { integrationConfig } from "./env";
export const stationCookie = "electoral-station";
export const stationStateSchema = z.object({
  state: z.enum([
    "ready",
    "pending",
    "authorized",
    "consumed",
    "limited",
    "unavailable",
  ]),
  name: z.string().optional(),
  lists: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        number: z.number(),
        mayor: z.string().nullable(),
      }),
    )
    .optional(),
});
export type StationState = z.infer<typeof stationStateSchema> & {
  error?: string;
};
export async function stationRpc(
  operation: string,
  dni: string | null = null,
  choice: string | null = null,
) {
  const config = integrationConfig();
  if (
    !config ||
    process.env.ELECTORAL_SUPERVISED_DNI_ENABLED !== "true" ||
    !config.voting
  )
    throw new Error("La votación presencial está deshabilitada.");
  const token = (await cookies()).get(stationCookie)?.value;
  if (!token || !/^[A-Za-z0-9_-]{64}$/.test(token))
    throw new Error("Equipo no habilitado.");
  // Dedicated anon client: never forwards the administrator's Auth session.
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.rpc("station_electoral_operation", {
    p_token: token,
    p_operation: operation,
    p_dni: dni,
    p_choice: choice,
  });
  if (error)
    throw new Error(
      "Mesa no disponible. Consulta al comité; no reenvíes un voto sin comprobar su estado.",
    );
  const envelope = z
    .object({ purpose: z.enum(["test", "official"]) })
    .passthrough()
    .safeParse(data);
  if (
    !envelope.success ||
    (envelope.data.purpose === "official" && !config.official)
  )
    throw new Error("Votación oficial deshabilitada.");
  return stationStateSchema.parse(data);
}

export async function stationPresentation() {
 const config=integrationConfig();
 if(!config || !config.voting || process.env.ELECTORAL_SUPERVISED_DNI_ENABLED!=="true") throw new Error();
 const token=(await cookies()).get(stationCookie)?.value;
 if(!token || !/^[A-Za-z0-9_-]{64}$/.test(token)) throw new Error();
 const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const result=await client.rpc("get_station_presentation",{p_token:token});
 if(result.error) throw new Error();
 const data=presentationSchema.parse(result.data);
 if(data.purpose==="official"&&!config.official) throw new Error();
 return data;
}
