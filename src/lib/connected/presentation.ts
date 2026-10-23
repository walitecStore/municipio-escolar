import { z } from "zod";
export const badgeSchema = z.string().max(200000).regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
export const presentationSchema = z.object({
 school: z.string(), purpose: z.enum(["test","official"]), logo: badgeSchema.nullable(),
 lists: z.array(z.object({id:z.string().uuid(),name:z.string(),number:z.number().nullable(),mayor:z.string().nullable(),photo:badgeSchema.nullable(),symbol:badgeSchema.nullable()})),
});
export type BallotPresentation = z.infer<typeof presentationSchema>;
