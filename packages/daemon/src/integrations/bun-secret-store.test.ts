import { describe, expect, test } from "bun:test";
import { createBunSecretStore, KEYCHAIN_SERVICE, type KeychainBackend } from "./bun-secret-store";
import { createRedactor } from "./redact";

function memoryBackend(): KeychainBackend & { calls: string[] } {
  const values = new Map<string, string>();
  const calls: string[] = [];
  return {
    calls,
    get: async ({ service, name }) => {
      calls.push(`get ${service} ${name}`);
      return values.get(name) ?? null;
    },
    set: async ({ name, value }) => {
      calls.push(`set ${name}`);
      values.set(name, value);
    },
    delete: async ({ name }) => values.delete(name),
  };
}

const broken: KeychainBackend = {
  get: async () => {
    throw new Error("Secret Service is not available");
  },
  set: async () => {
    throw new Error("Secret Service is not available");
  },
  delete: async () => {
    throw new Error("Secret Service is not available");
  },
};

describe("keychain secret store", () => {
  test("stores under the kibo service and registers values for redaction", async () => {
    const backend = memoryBackend();
    const r = createRedactor();
    const store = createBunSecretStore(r, backend);
    await store.set("github", "ghp_TESTSECRET0123456789abcdefghijklmn");
    expect(await store.has("github")).toBe(true);
    expect(await store.get("github")).toBe("ghp_TESTSECRET0123456789abcdefghijklmn");
    expect(backend.calls).toContain(`get ${KEYCHAIN_SERVICE} github`);
    expect(r.redact("x ghp_TESTSECRET0123456789abcdefghijklmn")).toBe("x ***");
    await store.delete("github");
    expect(await store.get("github")).toBeNull();
  });

  test("an unavailable keychain is an explicit error, never a plaintext fallback", async () => {
    const store = createBunSecretStore(createRedactor(), broken);
    expect(await store.availability()).toEqual({ ok: false, reason: "Secret Service is not available" });
    await expect(store.set("github", "ghp_value_123456")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
    await expect(store.get("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
    await expect(store.has("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
  });

  test("invalid names and empty values never reach the backend", async () => {
    const backend = memoryBackend();
    const store = createBunSecretStore(createRedactor(), backend);
    await expect(store.set("github", "")).rejects.toThrow("INVALID_INPUT");
    await expect(store.get("aws" as "github")).rejects.toThrow("INVALID_INPUT");
    expect(backend.calls).toEqual([]);
  });

  test("a keychain that never answers times out instead of blocking the daemon", async () => {
    const pending = new Promise<never>(() => undefined);
    const stuck: KeychainBackend = { get: () => pending, set: () => pending, delete: () => pending };
    const store = createBunSecretStore(createRedactor(), stuck, { timeoutMs: 10 });
    expect(await store.availability()).toEqual({ ok: false, reason: "keychain timed out" });
    await expect(store.get("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE: get: keychain timed out");
    await expect(store.set("github", "ghp_value_123456")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
    await expect(store.delete("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
  });

  test("a call still stuck after its timeout makes the next ones fail fast", async () => {
    let started = 0;
    let finish: (v: string | null) => void = () => undefined;
    const late = new Promise<string | null>((resolve) => {
      finish = resolve;
    });
    const stuck: KeychainBackend = {
      get: () => {
        started++;
        return late;
      },
      set: async () => undefined,
      delete: async () => true,
    };
    const store = createBunSecretStore(createRedactor(), stuck, { timeoutMs: 10 });
    await expect(store.get("github")).rejects.toThrow("keychain timed out");
    await expect(store.get("github")).rejects.toThrow("keychain busy");
    await expect(store.get("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
    expect(started).toBe(1);
    expect(await store.availability()).toEqual({ ok: false, reason: "keychain timed out" });
    expect(await store.availability()).toEqual({ ok: false, reason: "keychain busy" });
    expect(started).toBe(2);
    finish("ghp_late_value_123456");
    await late;
    await Bun.sleep(0);
    expect(await store.get("github")).toBe("ghp_late_value_123456");
    expect(started).toBe(3);
  });

  test("simultaneous reads share one keychain call", async () => {
    let started = 0;
    const backend: KeychainBackend = {
      get: async () => {
        started++;
        return "ghp_shared_value_123456";
      },
      set: async () => undefined,
      delete: async () => true,
    };
    const store = createBunSecretStore(createRedactor(), backend);
    const values = await Promise.all([store.get("github"), store.get("github"), store.has("github")]);
    expect(values).toEqual(["ghp_shared_value_123456", "ghp_shared_value_123456", true]);
    expect(started).toBe(1);
  });

  test.if(process.env.KIBO_TEST_KEYCHAIN === "1")("real keychain round-trip", async () => {
    const store = createBunSecretStore(createRedactor());
    await store.set("mcp:kibo-test", "kibo-keychain-test-value");
    expect(await store.get("mcp:kibo-test")).toBe("kibo-keychain-test-value");
    await store.delete("mcp:kibo-test");
    expect(await store.get("mcp:kibo-test")).toBeNull();
  });
});
