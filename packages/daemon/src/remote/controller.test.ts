import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MacMessage } from "@kibo/remote";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { openStore } from "../store";
import { createRemoteController } from "./controller";
import { createExclusive } from "./exclusive";
import type { RemoteLink } from "./link";
import type { Pusher } from "./pusher";
import { openRemoteSecrets } from "./secrets";
import { openRemoteSettings } from "./settings";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const clean of cleanups.splice(0).reverse()) clean();
});

function fakeLink(confirms: boolean) {
  const sent: MacMessage[] = [];
  const link: RemoteLink = {
    start: async () => {},
    rotate: async () => {},
    keys: () => null,
    rootKey: () => null,
    send: (message) => {
      sent.push(message);
      return true;
    },
    sendConfirmed: async (message) => {
      sent.push(message);
      return confirms;
    },
    connected: () => true,
    opened: async () => true,
    pairToken: async () => ({ type: "pair.created", pairToken: "t", expiresAt: 1 }),
    stop: () => {},
  };
  return { link, sent };
}

const idlePusher: Pusher = {
  changed: () => {},
  pushAll: async () => {},
  pushProject: async () => {},
  removeProject: async () => {},
  idle: async () => {},
  lastPushAt: () => null,
  stop: () => {},
};

async function enabledController(confirms: boolean) {
  const home = mkdtempSync(join(tmpdir(), "kibo-remote-controller-"));
  const store = openStore(home);
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  cleanups.push(() => store.close());
  const keychain = createMemorySecretStore(createRedactor());
  const settings = openRemoteSettings(store);
  const secrets = openRemoteSecrets(keychain);
  await secrets.save({ rootKey: new Uint8Array(32), macToken: "mac-token" });
  settings.write({ enabled: true, serverUrl: "https://kibo.test", accountId: "acc", keyEpoch: 1 });
  const { link, sent } = fakeLink(confirms);
  const revocations: { serverUrl: string; macToken: string }[] = [];
  const controller = createRemoteController({
    settings,
    secrets,
    link,
    pusher: idlePusher,
    revoker: { start: (input) => revocations.push(input), stop: () => {} },
    defaultUrl: "https://kibo.test",
    fetch: async () => new Response(null),
    log: () => {},
    ready: Promise.resolve(),
    exclusive: createExclusive(),
  });
  return { controller, keychain, sent, revocations };
}

test("disable clears the keys only once the server confirmed the revocation", async () => {
  const c = await enabledController(true);
  expect(await c.controller.disable()).toMatchObject({ enabled: false, revokePending: false });
  expect(c.sent).toEqual([{ type: "phone.revoke" }]);
  expect([...c.keychain.dump().keys()]).toEqual([]);
  expect(c.revocations).toEqual([]);
});

test("disable whose revocation is sent but never confirmed keeps the mac token and retries it later", async () => {
  const c = await enabledController(false);
  expect(await c.controller.disable()).toMatchObject({ enabled: false, revokePending: true });
  expect([...c.keychain.dump().keys()]).toEqual(["remote:server"]);
  expect(c.revocations).toEqual([{ serverUrl: "https://kibo.test", macToken: "mac-token" }]);
});
