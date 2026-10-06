import {
  type ComponentSummary,
  type ConfigField,
  type ConfigSchema,
  frameList,
  type Instance,
  splitRef,
} from "@kibo/schema";
import { frWidgets } from "../i18n/fr-widgets";
import { findComponent } from "../registry";

export type FieldValue = string | number | boolean | string[] | null;
export type FieldKind = "enum" | "boolean" | "number" | "string" | "asset" | "frame" | "frames";
export type FormField = { key: string; field: ConfigField; value: FieldValue };

export const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");

const isFieldValue = (v: unknown): v is FieldValue =>
  v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean" || isStringList(v);

export const fieldKind = (field: ConfigField): FieldKind => {
  if (field.list) return "frames";
  if (field.frame) return "frame";
  if (field.asset) return "asset";
  return field.enum ? "enum" : (field.type ?? "string");
};

export const fieldLabel = (key: string, field: ConfigField): string =>
  field.label ?? frWidgets.fieldLabel(key);

export const numberBounds = (field: ConfigField): { min?: number; max?: number } => ({
  ...(field.min !== undefined && { min: field.min }),
  ...(field.max !== undefined && { max: field.max }),
});

function neutralValue(field: ConfigField): FieldValue {
  if (field.list) return [];
  if (field.nullable) return null;
  if (field.enum) return field.enum[0] ?? "";
  if (field.type === "boolean") return false;
  if (field.type === "number") return 0;
  return "";
}

function initialValue(field: ConfigField, raw: unknown): FieldValue {
  if (field.list) return frameList(raw === undefined ? field.default : raw);
  if (isFieldValue(raw) && (raw !== null || field.nullable)) return raw;
  if (isFieldValue(field.default)) return field.default;
  return neutralValue(field);
}

export function configFields(schema: ConfigSchema, config: Record<string, unknown>): FormField[] {
  return Object.entries(schema).map(([key, field]) => ({
    key,
    field,
    value: initialValue(field, config[key]),
  }));
}

export const normalizedValues = (
  fields: FormField[],
  values: Record<string, FieldValue>,
): Record<string, FieldValue> =>
  Object.fromEntries(
    fields.map((f) => {
      const value = values[f.key] ?? null;
      return [f.key, fieldKind(f.field) === "frames" ? frameList(value) : value];
    }),
  );

export function parseFieldInput(field: ConfigField, raw: string): FieldValue {
  if (raw === "" && field.nullable) return null;
  if (field.enum) return field.enum.find((e) => String(e) === raw) ?? raw;
  if (field.type === "number") {
    const n = Number(raw);
    return raw.trim() === "" || Number.isNaN(n) ? raw : n;
  }
  if (field.type === "boolean") return raw === "true";
  return raw;
}

export function withFieldValue(
  config: Record<string, unknown>,
  key: string,
  value: FieldValue,
): Record<string, unknown> {
  return { ...config, [key]: value };
}

const nonEmpty = (schema: ConfigSchema | undefined): ConfigSchema | null =>
  schema && Object.keys(schema).length > 0 ? schema : null;

export function configSchemaOf(
  instance: Instance,
  components: ComponentSummary[] | null,
): ConfigSchema | null {
  const builtin = findComponent(instance.component);
  if (builtin) return nonEmpty(builtin.manifest.configSchema);
  const { id, version } = splitRef(instance.component);
  const summary = components?.find((c) => c.id === id && !c.builtin);
  return nonEmpty(summary?.versions.find((v) => v.version === version)?.manifest?.configSchema);
}
