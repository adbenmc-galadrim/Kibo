import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { readDaemonInfo } from "./components/daemon-info";
import { fakeBuild, okReport, writeDraft } from "./components/service.test-helper";
import { type DaemonOptions, startDaemon } from "./daemon";

const VITE = "http://localhost:5173";
const Published = z.object({ result: z.object({ version: z.object({ hash: z.string() }) }) });
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function launch(opts: Partial<DaemonOptions> = {}) {
  const home = opts.home ?? mkdtempSync(join(tmpdir(), "kibo-start-"));
  const d = await startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    ...opts,
    home,
  });
  let stopped = false;
  const stop = async () => {
    if (!stopped) await d.stop();
    stopped = true;
  };
  cleanups.push(async () => {
    await stop();
    rmSync(home, { recursive: true, force: true });
  });
  return { d, home, stop };
}

async function pair({ url, token }: { url: string; token: string }) {
  const res = await fetch(`${url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: url },
    body: JSON.stringify({ token }),
  });
  expect(res.status).toBe(204);
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return (req: RpcRequest, origin = url) =>
    fetch(`${url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify(req),
    });
}

describe("startDaemon", () => {
  test("the daemon starts both listeners, writes daemon.json and removes it on stop", async () => {
    const { d, home, stop } = await launch();
    expect(readDaemonInfo(home)).toEqual({ port: d.port, sandboxPort: d.sandboxPort, pid: process.pid });
    expect(d.url).toBe(`http://127.0.0.1:${d.port}`);
    expect(d.sandboxPort).not.toBe(d.port);
    const sandbox = await fetch(`http://127.0.0.1:${d.sandboxPort}/api/rpc`);
    expect(sandbox.status).toBe(404);
    const ui = await fetch(`${d.url}/`);
    expect(ui.headers.get("content-security-policy")).toContain(
      `frame-src http://127.0.0.1:${d.sandboxPort};`,
    );
    await stop();
    expect(readDaemonInfo(home)).toBeNull();
  });

  test("a corrupt daemon.json never prevents the start", async () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-start-"));
    writeFileSync(join(home, "daemon.json"), "{not json", { mode: 0o400 });
    const { d } = await launch({ home });
    expect(readDaemonInfo(home)).toMatchObject({ port: d.port });
  });

  test("a busy sandbox port fails the start and releases what was opened", async () => {
    const busy = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("busy") });
    const home = mkdtempSync(join(tmpdir(), "kibo-start-"));
    try {
      await expect(launch({ home, sandboxPort: busy.port ?? 0 })).rejects.toThrow();
      expect(readDaemonInfo(home)).toBeNull();
      const { d } = await launch({ home });
      expect(readDaemonInfo(home)).toMatchObject({ port: d.port });
    } finally {
      busy.stop(true);
    }
  });

  test("a sandboxed component is published, approved and served over HTTP", async () => {
    const { d, home } = await launch();
    const rpc = await pair(d);
    const info = await (await rpc({ method: "getRuntimeInfo" })).json();
    expect(info).toEqual({ ok: true, result: { sandboxOrigin: `http://127.0.0.1:${d.sandboxPort}` } });
    writeDraft(home, "0.1.0");
    const published = await rpc({ method: "publishComponent", id: "hello", strategy: "new-version" });
    const { hash } = Published.parse(await published.json()).result.version;
    const approve = (h: string) =>
      rpc({ method: "approveComponent", id: "hello", version: "0.1.0", hash: h, trust: "sandboxed" });
    const stale = await approve("0".repeat(64));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, error: { code: "HASH_MISMATCH" } });
    expect((await approve(hash)).status).toBe(200);
    const page = `http://127.0.0.1:${d.sandboxPort}/c/hello/0.1.0/${hash}/index.html`;
    expect((await fetch(page)).status).toBe(200);
    await rpc({ method: "revokeComponent", id: "hello", version: "0.1.0" });
    expect((await fetch(page)).status).toBe(404);
  });

  test("in dev, Vite may call the api and frame the sandbox, the sandbox origin never calls the api", async () => {
    const { d } = await launch({ dev: true });
    const rpc = await pair(d);
    const sandboxOrigin = `http://127.0.0.1:${d.sandboxPort}`;
    expect((await rpc({ method: "listProjects" }, VITE)).status).toBe(200);
    expect((await rpc({ method: "listProjects" }, sandboxOrigin)).status).toBe(403);
    expect((await rpc({ method: "listProjects" }, "null")).status).toBe(403);
    const refused = await fetch(`${sandboxOrigin}/c/hello/0.1.0/${"0".repeat(64)}/index.html`);
    expect(refused.headers.get("content-security-policy")).toContain(
      `frame-ancestors http://127.0.0.1:${d.port} http://localhost:${d.port} ${VITE};`,
    );
  });
});
