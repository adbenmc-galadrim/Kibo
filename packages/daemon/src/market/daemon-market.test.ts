import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { osSandbox } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { makeTestPackage } from "@kibo/trust/testing";
import { fakeBuild, okReport } from "../components/service.test-helper";
import { type Daemon, startDaemon } from "../daemon";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";

const sandboxAvailable = await osSandbox()
  .ready()
  .then(
    () => true,
    (e: unknown) => {
      if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return false;
      throw e;
    },
  );

let home: string;
let daemon: Daemon;
let fake: FakeMarket;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-market-daemon-"));
  fake = await startFakeMarket();
  daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    marketAllowLoopback: true,
  });
});
afterEach(async () => {
  await daemon.stop();
  fake.stop();
  rmSync(home, { recursive: true, force: true });
});

async function rpc(req: RpcRequest): Promise<unknown> {
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const res = await fetch(`${daemon.url}/api/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url, cookie },
    body: JSON.stringify(req),
  });
  const body: unknown = await res.json();
  expect(res.status).toBe(200);
  return body;
}

test("the daemon answers the market RPCs through its handler", async () => {
  await fake.publish((await makeTestPackage({ id: "burndown", version: "0.1.0" })).bytes);
  await rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey });
  expect(await rpc({ method: "searchMarket", query: "burn" })).toMatchObject({
    result: [{ sourceId: "equipe", id: "burndown", latest: "0.1.0" }],
  });
});

test.if(sandboxAvailable)("an installed market version is listed without trust", async () => {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  await fake.publish(made.bytes);
  await rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey });
  expect(
    await rpc({ method: "installFromMarket", sourceId: "equipe", id: "burndown", version: "0.1.0" }),
  ).toMatchObject({ result: { id: "burndown", version: "0.1.0", hash: made.pkg.hash } });
  expect(await rpc({ method: "listComponents" })).toMatchObject({
    result: expect.arrayContaining([
      expect.objectContaining({
        id: "burndown",
        versions: [
          expect.objectContaining({ version: "0.1.0", origin: "marketplace", trust: null, active: false }),
        ],
      }),
    ]),
  });
});
