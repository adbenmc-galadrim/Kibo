import { z } from "zod";

export const SkillId = z.string().regex(/^([a-z0-9][a-z0-9-]{0,63}:)?[a-z0-9][a-z0-9._-]{0,63}$/);
export type SkillId = z.infer<typeof SkillId>;
