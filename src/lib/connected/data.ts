import { z } from "zod";
import { uuid } from "./policy";
export const rollSchema = z.array(
  z.object({
    id: uuid,
    code: z.string(),
    full_name: z.string(),
    grade: z.number(),
    section: z.string(),
    auth_user_id: uuid.nullable(),
  }),
);
export type ConnectedElector = z.infer<typeof rollSchema>[number];
export const listsSchema = z.array(
  z.object({
    id: uuid,
    name: z.string(),
    number: z.number().nullable(),
    proposals: z.array(z.string()),
    symbol_path: z.string().nullable(),
    candidates: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        role: z.enum(["alcalde", "regidor"]),
        position: z.number(),
        title: z.string(),
        grade: z.number(),
        section: z.string(),
        photo_path: z.string().nullable(),
      }),
    ),
  }),
);
export type ConnectedList = z.infer<typeof listsSchema>[number];
export const resultsSchema = z.object({
  election_id: uuid,
  state: z.literal("closed"),
  electors: z.number(),
  voters: z.number(),
  pending: z.number(),
  blank: z.number(),
  blank_percentage: z.number(),
  participation: z.number(),
  lists: z.array(
    z.object({
      id: uuid,
      number: z.number(),
      name: z.string(),
      votes: z.number(),
      percentage: z.number(),
      winner: z.boolean(),
    }),
  ),
});
export const summarySchema = z.array(
  z.object({
    grade: z.number(),
    section: z.string(),
    electors: z.coerce.number(),
    voters: z.coerce.number(),
    pending: z.coerce.number(),
  }),
);
