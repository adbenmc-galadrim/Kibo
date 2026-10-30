import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, SecretNameSchema } from "@kibo/schema";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import type { SecretStore } from "../integrations/types";
import { openRunStore, type RunStore } from "../runs/run-store";
import { ORPHAN_SECRET_NAMES, pruneOrphanSecrets, SECRETS_PRUNED_MARKER } from "./legacy-secrets";

const NOW = 1_700_000_000_000;
const dirs: string[] = [];
const stores: RunStore[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function runs(): RunStore {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-secrets-"));
  dirs.push(home);
  const store = openRunStore(home);
  stores.push(store);
  return store;
}

const KEPT = { figma: "figd_x", penpot: "penpot-token", github: "ghp_x", "mcp:linear:API_KEY": "lin_x" };

test("the three orphan names are deleted once and the marker is set", async () => {
  const secrets = createMemorySecretStore(createRedactor(), {
    ...KEPT,
    "remote:tls": "key",
    "sync:device": "device",
    "market:publisher": "publisher",
  });
  const store = runs();
  expect(ORPHAN_SECRET_NAMES).toEqual(["remote:tls", "sync:device", "market:publisher"]);
  expect(await pruneOrphanSecrets(secrets, store, () => NOW)).toEqual([...ORPHAN_SECRET_NAMES]);
  expect([...secrets.dump().keys()].sort()).toEqual(Object.keys(KEPT).sort());
  expect(store.marker(SECRETS_PRUNED_MARKER)).toBe(new Date(NOW).toISOString());
  await secrets.set("figma", "figd_y");
  expect(await pruneOrphanSecrets(secrets, store, () => NOW + 1)).toEqual([]);
  expect(await secrets.get("figma")).toBe("figd_y");
});

test("a store error leaves the marker unset, and the next start tries again", async () => {
  const memory = createMemorySecretStore(createRedactor(), { "sync:device": "device", figma: "figd_x" });
  const failing: SecretStore = {
    ...memory,
    delete: async () => {
      throw new KiboError("SECRET_STORE_UNAVAILABLE", "keychain locked");
    },
  };
  const store = runs();
  await expect(pruneOrphanSecrets(failing, store, () => NOW)).rejects.toMatchObject({
    code: "SECRET_STORE_UNAVAILABLE",
  });
  expect(store.marker(SECRETS_PRUNED_MARKER)).toBeNull();
  expect(await pruneOrphanSecrets(memory, store, () => NOW)).toEqual([...ORPHAN_SECRET_NAMES]);
  expect([...memory.dump().keys()]).toEqual(["figma"]);
});

test("the orphan names are no longer valid secret names", () => {
  for (const name of ORPHAN_SECRET_NAMES) expect(SecretNameSchema.safeParse(name).success).toBe(false);
});
