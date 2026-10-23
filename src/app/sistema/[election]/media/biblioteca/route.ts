import { protectedElection } from "@/lib/connected/session";
export async function GET(request: Request, { params }: { params: Promise<{ election: string }> }) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
  try {
    const id = (await params).election;
    const { client } = await protectedElection(id, true);
    const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100) return Response.json({ error: "Página inválida" }, { status: 400, headers });
    const { data, error } = await client.storage.from("electoral-media").list(id, {
      limit: 100, offset: page * 100, sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw new Error();
    const files = (data ?? []).filter(file => file.id && /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(file.name)).map(file => ({ path: `${id}/${file.name}`, date: file.created_at ?? null }));
    return Response.json({ files, more: data?.length === 100 }, { headers });
  } catch {
    return Response.json({ error: "No se pudo consultar la biblioteca. Revisa tu sesión y vuelve a intentar." }, { status: 403, headers });
  }
}
