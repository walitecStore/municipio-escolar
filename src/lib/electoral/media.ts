import sharp from "sharp";
import { randomUUID } from "node:crypto";
/** Server-only sanitization, before private Storage upload with an authorized session.
 * No original filename is retained. No network or filesystem writes. */
export async function preparePrivateElectoralImage(
  input: Uint8Array,
  election: string,
) {
  if (
    !/^[a-f0-9-]{36}$/.test(election) ||
    input.byteLength > 5 * 1024 * 1024 ||
    !input.byteLength
  )
    throw new Error("Imagen electoral inválida.");
  try {
    const image = sharp(input, {
      limitInputPixels: 20_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Formato no admitido.");
    // Sharp strips EXIF/GPS by default; do not add keepMetadata()/withMetadata().
    const bytes = await image
      .rotate()
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return {
      bytes,
      contentType: "image/webp" as const,
      path: `${election}/${randomUUID()}.webp`,
    };
  } catch {
    throw new Error("No se pudo validar y sanear la imagen electoral.");
  }
}
