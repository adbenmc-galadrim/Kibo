import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { ComponentCall, RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { type Daemon, startDaemon } from "../daemon";
import {
  type Client,
  eventually,
  type JournalRow,
  pair,
  readJournal,
  runtimeChildren,
} from "./exit.test-helper";
import { runtimeGone, runtimeSelf } from "./runtime-liveness.test-helper";
import { okReport } from "./service.test-helper";

const REF = "evil@0.1.0";
const BURST = 10;
const Id = z.object({ id: z.string() });
const Published = z.object({ version: z.object({ hash: z.string() }) });
const Snapshot = z.object({ tickets: z.array(z.object({ id: z.string(), title: z.string() })) });
const Attack = z.object({
  tickets: z.number(),
  refusals: z.record(z.string(), z.string()),
  globals: z.record(z.string(), z.string()),
});
const Flood = z.object({ allowed: z.number(), limited: z.number(), other: z.array(z.string()) });

// bubblewrap exports PWD for the directory given to --chdir
const sandboxedEnv = process.platform === "linux" ? ["KIBO_COMPONENT", "PWD"] : ["KIBO_COMPONENT"];
const home = mkdtempSync(join(tmpdir(), "kibo-exit-"));
const earlier = new Set(runtimeChildren());
const reached: string[] = [];
let daemon: Daemon;
let client: Client;
let stopped = false;
let projectId = "";
let instanceId = "";
let hash = "";
let limited = 0;

const stop = async () => {
  if (stopped) return;
  stopped = true;
  await daemon.stop();
};
const call = (c: ComponentCall): RpcRequest => ({ method: "componentCall", projectId, instanceId, call: c });
const action = (name: string, input: unknown = null) => call({ kind: "action", name, input });
const approve = (): RpcRequest => ({
  method: "approveComponent",
  id: "evil",
  version: "0.1.0",
  hash,
  trust: "sandboxed",
});
const titles = async () =>
  Snapshot.parse(await client.ok({ method: "getProject", projectId })).tickets.map((t) => t.title);
const backUp = () =>
  eventually(async () => (await client.post(action("ping"), daemon.url)).status === 200, 15_000);
const row = (kind: string, code: string, count = 1): JournalRow => ({ kind, code, count });
const denied = { status: 403, code: "PERMISSION_DENIED" };
const trustRequired = { status: 403, code: "TRUST_REQUIRED" };
const crashed = { status: 502, code: "COMPONENT_CRASHED" };
const ungranted = (ticketId: string): ComponentCall[] => [
  { kind: "run", command: { method: "deleteTicket", ticketId } },
  { kind: "fetch", url: "https://example.com", init: { method: "GET", headers: {} } },
  { kind: "fetch", url: "https://kibo-evil.test/", init: { method: "GET", headers: {} } },
  { kind: "data.set", key: "k", value: 1 },
  { kind: "run", command: { method: "setInstanceData", instanceId, key: "k", value: 1 } },
  { kind: "list", entity: "link" },
];
const refusedRows = () =>
  ["run", "fetch", "fetch", "data.set", "run", "list"].map((kind) => row(kind, "PERMISSION_DENIED"));

beforeAll(async () => {
  daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    validate: okReport,
    net: {
      resolve: async () => ["127.0.0.1"],
      transport: async (url) => {
        reached.push(url);
        return new Response("leaked");
      },
    },
  });
  client = await pair(daemon);
  const project = await client.ok({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  projectId = Id.parse(project).id;
  await client.ok({ method: "command", projectId, command: { method: "createTicket", title: "Précieux" } });
  const page = Id.parse(
    await client.ok({
      method: "command",
      projectId,
      command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" },
    }),
  );
  const evil = copyFixture("evil", { linkModules: false });
  cpSync(evil.dir, join(home, "components", "src", "evil"), { recursive: true });
  evil.dispose();
  const published = await client.ok({ method: "publishComponent", id: "evil", strategy: "new-version" });
  hash = Published.parse(published).version.hash;
  const instance = await client.ok({
    method: "command",
    projectId,
    command: { method: "addInstance", pageId: page.id, component: REF },
  });
  instanceId = Id.parse(instance).id;
}, 120_000);

afterAll(async () => {
  await stop();
  rmSync(home, { recursive: true, force: true });
});

describe("a sandboxed third-party component stays inside its perimeter", () => {
  test("nothing runs before the approval, nor once its code changed on disk", async () => {
    expect(await client.refused(call({ kind: "list", entity: "ticket" }))).toEqual(trustRequired);
    await client.ok(approve());
    const serverJs = join(home, "components", "store", "evil", "0.1.0", hash, "build", "server.js");
    const original = readFileSync(serverJs);
    chmodSync(serverJs, 0o600);
    writeFileSync(serverJs, `${original};`);
    expect(await client.refused(action("ping"))).toEqual(trustRequired);
    expect(await client.refused(call({ kind: "list", entity: "ticket" }))).toEqual(trustRequired);
    writeFileSync(serverJs, original);
    chmodSync(serverJs, 0o400);
    await client.ok(approve());
    expect(await client.ok(action("ping"))).toBe("pong");
  }, 30_000);

  test("the sandbox port serves the frame only, without network nor API access", async () => {
    const sandbox = `http://127.0.0.1:${daemon.sandboxPort}`;
    const frame = await fetch(`${sandbox}/c/evil/0.1.0/${hash}/index.html`);
    expect(frame.status).toBe(200);
    expect(frame.headers.get("content-security-policy")).toContain("connect-src 'none'");
    expect((await fetch(`${sandbox}/api/rpc`)).status).toBe(404);
    expect((await client.post({ method: "listProjects" }, sandbox)).status).toBe(403);
    expect((await client.post({ method: "listProjects" }, "null")).status).toBe(403);
  });

  test("the gate refuses every call the frame was not granted", async () => {
    const [ticket] = Snapshot.parse(await client.ok({ method: "getProject", projectId })).tickets;
    expect(await client.ok(call({ kind: "list", entity: "ticket" }))).toHaveLength(1);
    for (const attempt of ungranted(ticket?.id ?? "")) {
      expect(await client.refused(call(attempt))).toEqual(denied);
    }
    expect(reached).toEqual([]);
    expect(await titles()).toEqual(["Précieux"]);
  });

  test("the backend meets the same gate, without capabilities nor a reusable context", async () => {
    expect(Attack.parse(await client.ok(action("attack")))).toEqual({
      tickets: 1,
      refusals: {
        deleteTicket: "PERMISSION_DENIED",
        fetch: "PERMISSION_DENIED",
        loopback: "PERMISSION_DENIED",
        data: "PERMISSION_DENIED",
        reserved: "PERMISSION_DENIED",
        links: "PERMISSION_DENIED",
      },
      globals: { fetch: "undefined", file: "undefined", spawn: "undefined", binding: "undefined" },
    });
    await client.ok(action("keep"));
    expect(await client.ok(action("reuse"))).toBe("PERMISSION_DENIED");
    expect(reached).toEqual([]);
    expect(await titles()).toEqual(["Précieux"]);
  }, 30_000);

  test("the OS sandbox keeps the backend off the disk, other processes and the network", async () => {
    const input = {
      secret: join(home, "token"),
      plant: join(home, "planted"),
      port: daemon.port,
      daemonPid: process.pid,
    };
    expect(await client.ok(action("escape", input))).toEqual({
      workdir: "open",
      read: "blocked",
      write: "blocked",
      spawn: "blocked",
      child: "blocked",
      signal: "blocked",
      connect: "blocked",
      env: sandboxedEnv,
      descriptors: [],
      worker: { net: "blocked", read: "blocked", signal: "blocked", spawn: "blocked" },
    });
    expect(existsSync(join(home, "planted"))).toBe(false);
  }, 30_000);

  test("the backend cannot choose the error code the UI sees", async () => {
    const internal = { status: 500, code: "INTERNAL" };
    expect(await client.refused(action("forge", "TRUST_REQUIRED"))).toEqual(internal);
    expect(await client.refused(action("forge", "UNAUTHORIZED"))).toEqual(internal);
    expect(await client.refused(action("forge", "CONFLICT"))).toEqual({ status: 409, code: "CONFLICT" });
  });

  test("a backend breaking the line protocol is stopped as a crash", async () => {
    const self = runtimeSelf(await client.ok(action("self")));
    expect(await client.refused(action("garbage"))).toEqual(crashed);
    expect(await runtimeGone(self)).toBe(true);
    expect(await backUp()).toBe(true);
    expect(await client.refused(action("oversize"))).toEqual(crashed);
    expect(await backUp()).toBe(true);
  }, 60_000);

  test("call quotas hold and a flood of refusals writes a bounded journal", async () => {
    const flood = Flood.parse(await client.ok(action("flood")));
    expect(flood.other).toEqual([]);
    expect(flood.limited).toBeGreaterThan(0);
    expect(flood.allowed).toBeLessThanOrEqual(200);
    limited = flood.limited;
    const rateLimited = readJournal(home, REF).filter((r) => r.code === "RATE_LIMITED");
    expect(rateLimited).toEqual(Array.from({ length: BURST }, () => row("list", "RATE_LIMITED")));
  }, 30_000);

  test("stopping the daemon kills every backend, even with a call in flight", async () => {
    await Bun.sleep(1_100);
    const self = runtimeSelf(await client.ok(action("self")));
    const inFlight = client.post(action("linger"), daemon.url).then(
      (res) => res.status,
      () => 0,
    );
    await Bun.sleep(200);
    const errors = spyOn(console, "error");
    await stop();
    const logged = errors.mock.calls.flat().map(String);
    errors.mockRestore();
    expect(logged.filter((m) => m.includes("Database has closed"))).toEqual([]);
    expect(await inFlight).not.toBe(200);
    expect(await runtimeGone(self)).toBe(true);
    expect(await eventually(() => runtimeChildren().every((pid) => earlier.has(pid)))).toBe(true);
    await expect(fetch(daemon.url)).rejects.toThrow();
    expect(readJournal(home, REF)).toEqual([
      row("list", "TRUST_REQUIRED"),
      row("verify", "TRUST_REQUIRED"),
      row("action", "TRUST_REQUIRED"),
      row("list", "TRUST_REQUIRED"),
      ...refusedRows(),
      ...refusedRows(),
      ...Array.from({ length: BURST }, () => row("list", "RATE_LIMITED")),
      row("list", "RATE_LIMITED", limited - BURST),
    ]);
  }, 30_000);
});
