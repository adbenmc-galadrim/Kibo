import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { z } from "zod";
import { startDaemon } from "./daemon";
import { FIXTURE_HOME_021 } from "./testing/make-home-0.21";
import { FIXTURE_HOME_032 } from "./testing/make-home-0.32";

const Agents = z.object({
  ok: z.literal(true),
  result: z.object({ runs: z.array(z.object({ id: z.string() })) }),
});
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function start(home: string) {
  const daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
  });
  const pair = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = pair.headers.get("set-cookie")?.split(";")[0] ?? "";
  const agents = async () => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: daemon.url, cookie },
      body: JSON.stringify({ method: "getAgents" }),
    });
    return Agents.parse(await res.json()).result.runs.map((r) => r.id);
  };
  return { daemon, agents };
}

function homeFrom(fixture: string): string {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-daemon-"));
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  cpSync(fixture, home, { recursive: true });
  return home;
}

test("a daemon started on the 0.32 fixture home lists the project agent runs only", async () => {
  const { daemon, agents } = await start(homeFrom(FIXTURE_HOME_032));
  cleanups.push(() => daemon.stop());
  expect(await agents()).toEqual(["p1", "p2"]);
}, 20_000);

test("a daemon started on the 0.21 fixture home migrates once, keeps the project run r4 and answers getAgents", async () => {
  const home = homeFrom(FIXTURE_HOME_021);
  const first = await start(home);
  expect(await first.agents()).toEqual([]);
  await first.daemon.stop();
  const second = await start(home);
  cleanups.push(() => second.daemon.stop());
  expect(await second.agents()).toEqual([]);
  expect(readdirSync(join(home, "backups")).filter((name) => name.endsWith("-avant-retrait"))).toHaveLength(
    1,
  );
  const runs = new Database(join(home, "runs.db"), { readonly: true });
  cleanups.push(() => runs.close());
  expect(runs.query("SELECT id, kind FROM runs").all()).toEqual([{ id: "r4", kind: "project" }]);
}, 20_000);
