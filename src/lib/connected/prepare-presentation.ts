import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listsSchema } from "./data";
import { preparePrivateElectoralImage } from "@/lib/electoral/media";
export async function smallBadge(bytes: Uint8Array, id: string) {
 const safe = await preparePrivateElectoralImage(bytes,id);
 const result = await sharp(safe.bytes).resize({width:256,height:256,fit:"inside",withoutEnlargement:true}).webp({quality:75}).toBuffer();
 const data = `data:image/webp;base64,${result.toString("base64")}`;
 if(data.length>200000) throw new Error("Imagen demasiado detallada");
 return data;
}
export async function preparePresentation(client:SupabaseClient,id:string) {
 const response = await client.rpc("get_electoral_lists",{p_election:id});
 if(response.error) throw new Error();
 const lists=listsSchema.parse(response.data);
 const paths=[...new Set(lists.flatMap(list=>[list.symbol_path,list.candidates.find(c=>c.role==="alcalde")?.photo_path]).filter((path):path is string=>!!path))];
 const images:Record<string,string>={};
 for(let index=0;index<paths.length;index+=4) await Promise.all(paths.slice(index,index+4).map(async path=>{
  if(!path.startsWith(`${id}/`)) throw new Error();
  const stored=await client.storage.from("electoral-media").download(path);
  if(stored.error||!stored.data||stored.data.size>5*1024*1024) throw new Error();
  images[path]=await smallBadge(new Uint8Array(await stored.data.arrayBuffer()),id);
 }));
 const saved=await client.rpc("prepare_electoral_presentation",{p_election:id,p_images:images});
 if(saved.error) throw new Error();
}
