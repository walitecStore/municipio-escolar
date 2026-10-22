"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
export function ElectoralImagePicker({
  field,
  label,
  current,
  election,
}: {
  field: "symbolFile" | "photoFile";
  label: string;
  current?: string | null;
  election: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    const form = input.current?.form;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        setFile(null);
        setPreview("");
        setError("");
      });
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  const src =
    preview ||
    (current
      ? `/sistema/${election}/media/archivo?path=${encodeURIComponent(current)}`
      : "");
  return (
    <div className="image-picker">
      <div className="image-picker-preview">
        {src /* Object URL or authenticated private image: never a public bucket URL. */ ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Vista previa: ${label}`} />
        ) : (
          <ImagePlus size={38} aria-hidden="true" />
        )}
      </div>
      <div className="image-picker-controls">
        <label className="image-picker-label">
          <Upload size={19} aria-hidden="true" />
          {label}
          <input
            ref={input}
            type="file"
            name={field}
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              if (
                selected &&
                (selected.size > 5 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    selected.type,
                  ))
              ) {
                setError(
                  "Selecciona una imagen PNG, JPG o WebP de hasta 5 MB.",
                );
                e.target.value = "";
                setFile(null);
                setPreview("");
                return;
              }
              setError("");
              setFile(selected);
              setPreview(selected ? URL.createObjectURL(selected) : "");
            }}
          />
        </label>
        <p>
          Selecciona una imagen de tu celular o computadora. Se guardará al
          registrar; no necesitas copiar rutas.
        </p>
        {file && (
          <label>
            <input
              type="checkbox"
              name={`${field}Consent`}
              value="yes"
              required
            />
            Tengo autorización para usar esta imagen.
          </label>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
