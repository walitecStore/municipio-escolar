import { preparePrivateElectoralImage } from "@/lib/electoral/media";
import { uuid } from "@/lib/connected/policy";
import { protectedElection } from "@/lib/connected/session";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ election: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  try {
    const id = (await params).election;
    const path = new URL(request.url).searchParams.get("path") ?? "";
    if (
      !uuid.safeParse(id).success ||
      path.length > 180 ||
      !new RegExp(`^${id}/[A-Za-z0-9_-]+\\.(jpg|jpeg|png|webp)$`).test(path)
    )
      return new Response("Archivo no disponible", { status: 404, headers });
    const { client } = await protectedElection(id);
    const response = await client.storage
      .from("electoral-media")
      .download(path);
    if (
      response.error ||
      !response.data ||
      response.data.size > 5 * 1024 * 1024
    )
      return new Response("Archivo no disponible", { status: 404, headers });
    const image = await preparePrivateElectoralImage(
      new Uint8Array(await response.data.arrayBuffer()),
      id,
    );
    return new Response(new Uint8Array(image.bytes), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response("Archivo no disponible", { status: 404, headers });
  }
}
