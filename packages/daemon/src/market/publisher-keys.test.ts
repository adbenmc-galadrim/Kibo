import { expect, test } from "bun:test";
import { SECRET_MARKET_PUBLISHER } from "@kibo/schema";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import type { SecretStore } from "../integrations/types";
import { loadPublisherKeys } from "./publisher-keys";

function slowSecrets(): SecretStore & { writes: string[] } {
  const inner = createMemorySecretStore(createRedactor());
  const writes: string[] = [];
  return {
    ...inner,
    writes,
    get: async (name) => {
      await Bun.sleep(5);
      return inner.get(name);
    },
    set: async (name, value) => {
      await Bun.sleep(5);
      writes.push(name);
      await inner.set(name, value);
    },
  };
}

test("two first loads at the same time create a single publisher key", async () => {
  const secrets = slowSecrets();
  const [first, second] = await Promise.all([
    loadPublisherKeys(secrets, "Adam"),
    loadPublisherKeys(secrets, "Autre"),
  ]);
  expect(second).toEqual(first);
  expect(secrets.writes).toEqual([SECRET_MARKET_PUBLISHER]);
  expect(await loadPublisherKeys(secrets)).toEqual(first);
});

test("a failed creation does not block the next one", async () => {
  const secrets = slowSecrets();
  await expect(loadPublisherKeys(secrets)).rejects.toThrow("INVALID_INPUT");
  expect((await loadPublisherKeys(secrets, "Adam")).name).toBe("Adam");
});
