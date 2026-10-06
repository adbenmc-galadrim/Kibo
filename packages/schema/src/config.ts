import { z } from "zod";
import { ProjectAssetKind } from "./asset";

export const ConfigField = z
  .object({
    type: z.enum(["string", "number", "boolean"]).optional(),
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .min(1)
      .optional(),
    nullable: z.boolean().optional(),
    default: z.unknown().optional(),
    label: z.string().min(1).max(80).optional(),
    help: z.string().max(200).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    asset: ProjectAssetKind.optional(),
    frame: z.literal(true).optional(),
    list: z.literal(true).optional(),
  })
  .strict()
  .refine(
    (f) => f.asset === undefined || f.type === undefined || f.type === "string",
    "an asset field is a string",
  )
  .refine(
    (f) => f.frame === undefined || f.type === undefined || f.type === "string",
    "a frame field is a string",
  )
  .refine((f) => f.list === undefined || f.frame === true, "a list field is a frame field")
  .refine((f) => f.min === undefined || f.max === undefined || f.min <= f.max, "min exceeds max");
export type ConfigField = z.infer<typeof ConfigField>;

export const ConfigSchema = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), ConfigField);
export type ConfigSchema = z.infer<typeof ConfigSchema>;

export function configDefaults(schema: ConfigSchema | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema ?? {}))
    if (field.default !== undefined) out[key] = field.default;
  return out;
}
