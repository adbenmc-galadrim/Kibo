import { z } from "zod";

export const ConfigField = z
  .object({
    type: z.enum(["string", "number", "boolean"]).optional(),
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .min(1)
      .optional(),
    nullable: z.boolean().optional(),
    default: z.unknown().optional(),
  })
  .strict();
export type ConfigField = z.infer<typeof ConfigField>;

export const ConfigSchema = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), ConfigField);
export type ConfigSchema = z.infer<typeof ConfigSchema>;

export function configDefaults(schema: ConfigSchema | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema ?? {}))
    if (field.default !== undefined) out[key] = field.default;
  return out;
}

const SCALAR = new Set(["string", "number", "boolean"]);

function fieldError(key: string, field: ConfigField, value: unknown): string | null {
  if (value === null) return field.nullable ? null : `${key}: null not allowed`;
  if (field.enum && !field.enum.some((e) => e === value))
    return `${key}: not one of ${field.enum.join(", ")}`;
  if (field.type && typeof value !== field.type) return `${key}: expected ${field.type}`;
  if (!SCALAR.has(typeof value)) return `${key}: unsupported value`;
  return null;
}

export function validateConfig(schema: ConfigSchema | undefined, config: Record<string, unknown>): string[] {
  const fields = schema ?? {};
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const field = fields[key];
    const error = field ? fieldError(key, field, value) : `${key}: unknown key`;
    if (error) errors.push(error);
  }
  return errors;
}
