import { KiboError, type SecretName, SecretNameSchema } from "@kibo/schema";
import type { Redactor } from "./redact";
import type { SecretStore } from "./types";

export const KEYCHAIN_SERVICE = "dev.kibo";
export const KEYCHAIN_TIMEOUT_MS = 60_000;

export type KeychainBackend = {
  get(o: { service: string; name: string }): Promise<string | null>;
  set(o: { service: string; name: string; value: string }): Promise<void>;
  delete(o: { service: string; name: string }): Promise<boolean>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function bounded<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("keychain timed out")), timeoutMs);
  });
  try {
    return await Promise.race([fn(), expired]);
  } finally {
    clearTimeout(timer);
  }
}

export function createBunSecretStore(
  redactor: Redactor,
  backend: KeychainBackend = Bun.secrets,
  opts: { timeoutMs?: number } = {},
): SecretStore {
  const timeoutMs = opts.timeoutMs ?? KEYCHAIN_TIMEOUT_MS;
  const key = (name: SecretName) => {
    if (!SecretNameSchema.safeParse(name).success)
      throw new KiboError("INVALID_INPUT", "invalid secret name");
    return { service: KEYCHAIN_SERVICE, name };
  };
  const call = async <T>(op: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await bounded(fn, timeoutMs);
    } catch (e) {
      throw new KiboError("SECRET_STORE_UNAVAILABLE", redactor.redact(`${op}: ${message(e)}`));
    }
  };
  const read = async (name: SecretName): Promise<string | null> => {
    const k = key(name);
    const value = await call("get", () => backend.get(k));
    if (!value) return null;
    redactor.add(value);
    return value;
  };
  return {
    async availability() {
      try {
        await bounded(() => backend.get({ service: KEYCHAIN_SERVICE, name: "probe" }), timeoutMs);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: redactor.redact(message(e)) };
      }
    },
    has: async (name) => (await read(name)) !== null,
    get: read,
    async set(name, value) {
      const k = key(name);
      if (!value) throw new KiboError("INVALID_INPUT", "empty secret");
      redactor.add(value);
      await call("set", () => backend.set({ ...k, value }));
    },
    async delete(name) {
      const k = key(name);
      await call("delete", () => backend.delete(k));
    },
  };
}
