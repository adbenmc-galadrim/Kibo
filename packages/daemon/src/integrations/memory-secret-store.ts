import { KiboError, type SecretName, SecretNameSchema } from "@kibo/schema";
import type { Redactor } from "./redact";
import type { SecretStore } from "./types";

export type MemorySecretStore = SecretStore & { dump(): Map<string, string> };

export function createMemorySecretStore(
  redactor: Redactor,
  initial: Record<string, string> = {},
): MemorySecretStore {
  const values = new Map(Object.entries(initial));
  for (const v of values.values()) redactor.add(v);
  const check = (name: SecretName) => {
    if (!SecretNameSchema.safeParse(name).success)
      throw new KiboError("INVALID_INPUT", "invalid secret name");
  };
  return {
    availability: async () => ({ ok: true }),
    has: async (name) => {
      check(name);
      return values.has(name);
    },
    get: async (name) => {
      check(name);
      const v = values.get(name) ?? null;
      if (v !== null) redactor.add(v);
      return v;
    },
    set: async (name, value) => {
      check(name);
      if (!value) throw new KiboError("INVALID_INPUT", "empty secret");
      redactor.add(value);
      values.set(name, value);
    },
    delete: async (name) => {
      check(name);
      values.delete(name);
    },
    dump: () => new Map(values),
  };
}

export function unavailableSecretStore(reason: string): SecretStore {
  const fail = async (): Promise<never> => {
    throw new KiboError("SECRET_STORE_UNAVAILABLE", reason);
  };
  return { availability: async () => ({ ok: false, reason }), has: fail, get: fail, set: fail, delete: fail };
}
