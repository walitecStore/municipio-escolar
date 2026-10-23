"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mutationOrigin, verifiedSession } from "@/lib/connected/session";
import { smallBadge } from "@/lib/connected/prepare-presentation";
export async function saveBadge(institution:string,form:FormData):Promise<{error?:string;logo?:string}> {
 try {
  await mutationOrigin(); z.string().uuid().parse(institution);
  const {client,session}=await verifiedSession();
  if(session.role!=="administrator"||session.aal!=="aal2") throw new Error();
  const file=form.get("badge");
  if(!(file instanceof File)||!file.size||file.size>3*1024*1024||form.get("consent")!=="yes") return {error:"Elige una imagen de hasta 3 MB y confirma su autorización."};
  const logo=await smallBadge(new Uint8Array(await file.arrayBuffer()),institution);
  const result=await client.rpc("save_institution_branding",{p_institution:institution,p_logo:logo});
  if(result.error) throw new Error();
  revalidatePath("/sistema/instituciones"); return {logo};
 } catch { return {error:"No se pudo guardar la insignia. Revisa tu sesión, autorización y la actualización de base de datos 011."}; }
}
