import { ProjectAssetName } from "./asset";
import type { ConfigField, ConfigSchema } from "./config";
import { parseDesignUrl } from "./design-url";

const SCALAR = new Set(["string", "number", "boolean"]);

function fieldError(key: string, field: ConfigField, value: unknown): string | null {
  if (value === null) return field.nullable ? null : `${key}: null not allowed`;
  if (field.enum && !field.enum.some((e) => e === value))
    return `${key}: not one of ${field.enum.join(", ")}`;
  if (field.type && typeof value !== field.type) return `${key}: expected ${field.type}`;
  if (!SCALAR.has(typeof value)) return `${key}: unsupported value`;
  if (field.asset && typeof value === "string" && !ProjectAssetName.safeParse(value).success)
    return `${key}: not a project file name`;
  if (field.frame && typeof value === "string" && parseDesignUrl(value) === null)
    return `${key}: not a figma or penpot frame url`;
  if (typeof value === "number" && field.min !== undefined && value < field.min)
    return `${key}: below ${field.min}`;
  if (typeof value === "number" && field.max !== undefined && value > field.max)
    return `${key}: above ${field.max}`;
  return null;
}

export function validateConfig(schema: ConfigSchema | undefined, config: Record<string, unknown>): string[] {
  const fields = schema ?? {};
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
    const error = field ? fieldError(key, field, value) : `${key}: unknown key`;
    if (error) errors.push(error);
  }
  return errors;
}
