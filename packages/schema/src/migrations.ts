import { KiboError } from "./errors";

type Json = Record<string, unknown>;
export type MigrationStep = { config?: (old: Json) => Json; data?: (old: Json) => Json };
export type Migrations = Readonly<Record<number, MigrationStep>>;

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export function applyMigrations(
  migrations: Migrations,
  from: number,
  to: number,
  input: { config: Json; data: Json },
): { config: Json; data: Json } {
  if (to < from) throw new KiboError("INVALID_INPUT", "configVersion cannot decrease");
  let { config, data } = input;
  for (let n = from + 1; n <= to; n += 1) {
    const step = migrations[n];
    if (step?.config) config = step.config(structuredClone(config));
    if (step?.data) data = step.data(structuredClone(data));
    if (!isRecord(config) || !isRecord(data))
      throw new KiboError("MIGRATION_FAILED", `step ${n} returned a non-object`);
  }
  return { config, data };
}
