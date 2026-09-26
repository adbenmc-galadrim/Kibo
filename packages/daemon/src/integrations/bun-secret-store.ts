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

class KeychainTimeout extends Error {
  constructor() {
    super("keychain timed out");
  }
}

async function bounded<T>(pending: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new KeychainTimeout()), timeoutMs);
  });
  try {
    return await Promise.race([pending, expired]);
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
  const stuck = new Set<string>();
  const reads = new Map<string, Promise<string | null>>();
  const key = (name: SecretName) => {
    if (!SecretNameSchema.safeParse(name).success)
      throw new KiboError("INVALID_INPUT", "invalid secret name");
    return { service: KEYCHAIN_SERVICE, name };
  };
  const guarded = async <T>(id: string, native: () => Promise<T>): Promise<T> => {
    if (stuck.has(id)) throw new Error("keychain busy");
    const pending = native();
    try {
      return await bounded(pending, timeoutMs);
    } catch (e) {
      if (e instanceof KeychainTimeout) {
        stuck.add(id);
        const release = () => stuck.delete(id);
        pending.then(release, release);
      }
      throw e;
    }
  };
  const sharedRead = (id: string, native: () => Promise<string | null>): Promise<string | null> => {
    const running = reads.get(id);
    if (running) return running;
    const read = guarded(id, native).finally(() => reads.delete(id));
    reads.set(id, read);
    return read;
  };
  const call = async <T>(op: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw new KiboError("SECRET_STORE_UNAVAILABLE", redactor.redact(`${op}: ${message(e)}`));
    }
  };
  const read = async (name: SecretName): Promise<string | null> => {
    const k = key(name);
    const value = await call("get", () => sharedRead(`get:${name}`, () => backend.get(k)));
    if (!value) return null;
    redactor.add(value);
    return value;
  };
  return {
    async availability() {
      try {
        await sharedRead("availability:probe", () =>
          backend.get({ service: KEYCHAIN_SERVICE, name: "probe" }),
        );
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
      await call("set", () => guarded(`set:${name}`, () => backend.set({ ...k, value })));
    },
    async delete(name) {
      const k = key(name);
      await call("delete", () => guarded(`delete:${name}`, () => backend.delete(k)));
    },
  };
}
