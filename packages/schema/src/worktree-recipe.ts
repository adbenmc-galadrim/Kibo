import { z } from "zod";

const climbs = (path: string): boolean => path.split("/").some((s) => s === "..");

export const RelativeFile = z
  .string()
  .min(1)
  .max(4096)
  .refine((p) => !p.startsWith("/") && !p.startsWith("~") && !climbs(p), "path must stay relative");
export const EnvKey = z.string().regex(/^[A-Z_][A-Z0-9_]{0,63}$/);
export const Port = z.number().int().min(1).max(65_535);

const atMost =
  (max: number) =>
  (record: Record<string, unknown>): boolean =>
    Object.keys(record).length <= max;

const RecipePorts = z.object({
  keys: z.record(EnvKey, Port).refine(atMost(8), "at most 8 ports"),
  from: z.number().int().min(0),
  step: z.number().int().min(1),
  count: z.number().int().min(1).max(200),
});

const RecipeEnv = z.object({
  file: RelativeFile,
  ports: RecipePorts.nullable(),
  replace: z
    .record(EnvKey, z.tuple([z.string().max(200), z.string().max(200)]))
    .refine(atMost(16), "at most 16 replacements"),
  set: z.record(EnvKey, z.string().max(500)).refine(atMost(32), "at most 32 assignments"),
});

export const WorktreeRecipe = z
  .object({
    copyFrom: z.array(z.string().min(1).max(4096)).max(8),
    copy: z.array(RelativeFile).max(32),
    env: RecipeEnv.nullable(),
    after: z.array(z.string().min(1).max(1000)).max(8),
  })
  .strict();
export type WorktreeRecipe = z.infer<typeof WorktreeRecipe>;
