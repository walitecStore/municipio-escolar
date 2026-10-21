import { z } from "zod";
export const institutionContextSchema = z.object({
  platform_operator: z.boolean(),
  institutions: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      expected_students: z.number().int().min(1).max(10000),
    }),
  ),
});
