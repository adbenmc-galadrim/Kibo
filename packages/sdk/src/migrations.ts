import { KiboError, type Migrations } from "@kibo/schema";

export type { MigrationStep, Migrations } from "@kibo/schema";

export function defineMigrations(m: Migrations): Migrations {
  for (const key of Object.keys(m)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1) {
      throw new KiboError("INVALID_INPUT", `migration ${key} must be an integer >= 1`);
    }
  }
  return m;
}
