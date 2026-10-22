import { z } from "zod";
import type { ConnectedList } from "./data";
export const candidateRegistrationSchema = z
  .object({
    id: z.union([z.literal(""), z.uuid()]),
    list: z.uuid({
      error: "Selecciona una lista registrada para este candidato.",
    }),
    name: z
      .string()
      .trim()
      .min(1, "Escribe los nombres y apellidos del candidato.")
      .max(120, "El nombre admite hasta 120 caracteres."),
    role: z.enum(["alcalde", "regidor"], {
      error: "Selecciona el cargo electoral.",
    }),
    position: z.coerce
      .number()
      .int("El orden debe ser un número entero.")
      .min(0, "El orden no puede ser negativo.")
      .max(20, "El orden máximo de regidores es 20."),
    title: z
      .string()
      .trim()
      .min(1, "Escribe el nombre del cargo.")
      .max(100, "El cargo admite hasta 100 caracteres."),
    grade: z.coerce
      .number()
      .int()
      .min(1, "Selecciona un grado del 1 al 5.")
      .max(5, "Selecciona un grado del 1 al 5."),
    section: z.enum(["A", "B", "C"], {
      error: "Selecciona una sección A, B o C.",
    }),
  })
  .superRefine((v, ctx) => {
    if (v.role === "alcalde" && v.position !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["position"],
        message:
          "El alcalde ocupa el orden 0. Para agregar otro integrante, selecciona Regidor.",
      });
    if (v.role === "regidor" && v.position < 1)
      ctx.addIssue({
        code: "custom",
        path: ["position"],
        message: "Selecciona un orden del 1 al 20 para el regidor.",
      });
  });
export function suggestCandidateSlot(list?: ConnectedList, exclude = "") {
  const others = list?.candidates.filter((c) => c.id !== exclude) ?? [];
  if (!others.some((c) => c.role === "alcalde"))
    return { role: "alcalde" as const, position: 0 };
  const used = new Set(others.map((c) => c.position));
  return {
    role: "regidor" as const,
    position:
      Array.from({ length: 20 }, (_, i) => i + 1).find((n) => !used.has(n)) ??
      1,
  };
}
export function candidateConflict(
  list: ConnectedList,
  candidate: { id: string; role: string; position: number },
) {
  const others = list.candidates.filter((c) => c.id !== candidate.id);
  if (candidate.role === "alcalde" && others.some((c) => c.role === "alcalde"))
    return "Esta lista ya tiene un alcalde registrado. Selecciona Regidor para agregar otro integrante o elige al alcalde existente en Candidatura para editarlo.";
  if (others.some((c) => c.position === candidate.position))
    return `El orden ${candidate.position} ya está ocupado en esta lista. Elige un orden libre para el regidor.`;
  return null;
}
