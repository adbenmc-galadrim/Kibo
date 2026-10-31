import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DaemonOptions, startDaemon } from "../daemon";
import { installFakeT3 } from "./testing/t3-kit";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function statusFrom(opts: Partial<DaemonOptions>) {
  const home = mkdtempSync(join(tmpdir(), "kibo-t3-daemon-"));
  const d = await startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    user: "adam",
    ...opts,
    home,
  });
  cleanups.push(async () => {
    await d.stop();
    rmSync(home, { recursive: true, force: true });
  });
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: d.url },
    body: JSON.stringify({ token: d.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const res = await fetch(`${d.url}/api/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: d.url, cookie },
    body: JSON.stringify({ method: "t3.status" }),
  });
  return res.json();
}

test("the daemon answers t3.status through the fake binary", async () => {
  const fake = installFakeT3();
  cleanups.push(fake.stop);
  expect(await statusFrom({ t3Bin: fake.bin })).toEqual({
    ok: true,
    result: { available: true, bin: fake.bin },
  });
  expect(fake.calls()).toEqual([["thread", "list", "--json"]]);
});

test("without KIBO_T3 and without t3 in the home folder, t3.status reports missing", async () => {
  const previous = process.env.KIBO_T3;
  delete process.env.KIBO_T3;
  cleanups.push(() => {
    if (previous !== undefined) process.env.KIBO_T3 = previous;
  });
  const userHome = mkdtempSync(join(tmpdir(), "kibo-t3-home-"));
  cleanups.push(() => rmSync(userHome, { recursive: true, force: true }));
  expect(await statusFrom({ userHome })).toMatchObject({
    ok: true,
    result: { available: false, reason: "missing", bin: join(userHome, ".t3", "bin", "t3") },
  });
});
