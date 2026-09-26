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

  test.if(process.env.KIBO_TEST_KEYCHAIN === "1")("real keychain round-trip", async () => {
    const store = createBunSecretStore(createRedactor());
    await store.set("mcp:kibo-test", "kibo-keychain-test-value");
    expect(await store.get("mcp:kibo-test")).toBe("kibo-keychain-test-value");
    await store.delete("mcp:kibo-test");
    expect(await store.get("mcp:kibo-test")).toBeNull();
  });
});
