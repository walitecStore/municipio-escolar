import { z } from "zod";
export const slateStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe los nombres y apellidos.")
    .max(120, "El nombre admite hasta 120 caracteres."),
  grade: z.coerce
    .number()
    .int()
    .min(1, "Selecciona el grado.")
    .max(5, "Selecciona un grado del 1 al 5."),
  section: z.enum(["A", "B", "C"], { error: "Selecciona la sección." }),
});
export const slateRegidorSchema = slateStudentSchema.extend({
  title: z
    .string()
    .trim()
    .min(1, "Escribe el cargo del regidor.")
    .max(100, "El cargo admite hasta 100 caracteres."),
});
export const slateRegistrationSchema = z.object({
  request: z.uuid(),
  party: z
    .string()
    .trim()
    .min(1, "Escribe el nombre del partido o agrupación escolar.")
    .max(120),
  proposals: z
    .array(z.string().trim().min(1).max(500))
    .min(1, "Escribe al menos una propuesta del partido.")
    .max(20),
  mayor: slateStudentSchema,
  regidors: z
    .array(slateRegidorSchema)
    .min(1, "Registra al menos un regidor antes de terminar.")
    .max(20, "Se permiten hasta 20 regidores."),
});
export const slateReceiptSchema = z.object({
  id: z.uuid(),
  number: z.number().int().min(1).max(99),
  deleted: z.boolean(),
});
export type SlateRegistration = z.infer<typeof slateRegistrationSchema>;
