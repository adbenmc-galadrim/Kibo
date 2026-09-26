import { afterEach, describe, expect, test } from "bun:test";
import { type ComponentCall, KiboError } from "@kibo/schema";
import { MIGRATIONS_JS, SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import type { BackendHost, HostOptions, InvokeRequest } from "./host-core";
import { createProcessHost } from "./process-host";
import { runtimeGone, runtimeSelf } from "./runtime-liveness.test-helper";

const hosts: BackendHost[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.stop();
});

type Extra = Partial<HostOptions> & { command?: string[] };

function host(extra: Extra = {}, calls: [string, string, ComponentCall][] = []) {
  const h = createProcessHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: MIGRATIONS_JS },
    onCall: async (projectId, instanceId, call) => {
      calls.push([projectId, instanceId, call]);
      return [{ key: "KIB-1" }];
    },
    backoffMs: [0],
    log: () => undefined,
    ...extra,
  });
  hosts.push(h);
  return h;
}
const action = (name: string, instanceId = "i1", input: unknown = null): InvokeRequest => ({
  projectId: "p1",
  instanceId,
  config: {},
  target: { action: name },
  input,
});

describe("process host", () => {
  test("runs an action and describes the backend", async () => {
    const h = host();
    expect(await h.invoke(action("ping"))).toBe("pong");
    expect(await h.describe()).toEqual({
      actions: [
        "ping",
        "caps",
        "tickets",
        "save",
        "late",
        "hang",
        "crash",
        "fail",
        "trust",
        "self",
        "wait",
        "bigint",
        "badCall",
      ],
      jobs: [{ name: "sync", everyMinutes: 5 }],
    });
    expect(h.running).toBe(true);
  });
  test("network, file and process capabilities are gone before the code runs", async () => {
    expect(await host().invoke(action("caps"))).toBe("undefined,undefined,undefined,undefined");
  });
  test("calls reach the daemon bound to the running invocation", async () => {
    const calls: [string, string, ComponentCall][] = [];
    const h = host({}, calls);
    expect(await h.invoke(action("tickets", "i7"))).toEqual([{ key: "KIB-1" }]);
    expect(calls).toEqual([["p1", "i7", { kind: "list", entity: "ticket" }]]);
  });
  test("a context kept after its invocation is useless", async () => {
    const calls: [string, string, ComponentCall][] = [];
    const h = host({}, calls);
    await h.invoke(action("save"));
    await expect(h.invoke(action("late"))).rejects.toThrow("PERMISSION_DENIED");
    expect(calls).toEqual([]);
  });
  test("malformed calls and unserializable results are refused in the backend", async () => {
    const calls: [string, string, ComponentCall][] = [];
    const h = host({}, calls);
    await expect(h.invoke(action("badCall"))).rejects.toThrow("INVALID_INPUT");
    await expect(h.invoke(action("bigint"))).rejects.toThrow("INTERNAL");
    expect(calls).toEqual([]);
  });
  test("unknown actions, errors, timeouts and crashes become KiboErrors", async () => {
    const h = host({ timeoutMs: 300 });
    await expect(h.invoke(action("nope"))).rejects.toThrow("PERMISSION_DENIED");
    await expect(h.invoke(action("fail"))).rejects.toThrow("CONFLICT");
    await expect(h.invoke(action("hang"))).rejects.toThrow("TIMEOUT");
    await expect(h.invoke(action("crash"))).rejects.toThrow("COMPONENT_CRASHED");
    expect(await h.invoke(action("ping"))).toBe("pong");
  });
  test("a backend cannot choose error codes outside the whitelist", async () => {
    const h = host();
    const error = await h.invoke(action("trust")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KiboError);
    expect(error).toMatchObject({ code: "INTERNAL" });
    expect(String(error)).toContain("TRUST_REQUIRED");
    expect(String(error)).toContain("approve me");
  });
  test("after a crash, the backend waits for its backoff", async () => {
    const h = host({ backoffMs: [60_000] });
    await expect(h.invoke(action("crash"))).rejects.toThrow("COMPONENT_CRASHED");
    await expect(h.invoke(action("ping"))).rejects.toThrow("COMPONENT_CRASHED");
  });
  test("a runtime that dies while starting fails fast and counts as a crash", async () => {
    const h = host({ command: [process.execPath, "-e", "process.exit(1)"], backoffMs: [60_000] });
    const started = Date.now();
    await expect(h.invoke(action("ping"))).rejects.toThrow("COMPONENT_CRASHED");
    expect(Date.now() - started).toBeLessThan(5_000);
    await expect(h.invoke(action("ping"))).rejects.toThrow("restarting");
    expect(h.running).toBe(false);
  });
  test("code that does not load crashes the runtime at start", async () => {
    const h = host({ code: { server: "module.exports.server = {", migrations: null } });
    await expect(h.invoke(action("ping"))).rejects.toThrow("COMPONENT_CRASHED");
  });
  test("migrations run in the backend of the target version", async () => {
    const h = host();
    const out = await h.invoke({
      projectId: "p1",
      instanceId: "i1",
      config: {},
      target: { migrate: { from: 0, to: 2, config: { a: 1 }, data: {} } },
      input: null,
    });
    expect(out).toEqual({ config: { a: 1, v: 1 }, data: { moved: true } });
  });
  test("jobs run and unknown jobs are not found", async () => {
    const h = host();
    const job = (name: string): InvokeRequest => ({ ...action("ping"), target: { job: name } });
    expect(await h.invoke(job("sync"))).toBeNull();
    await expect(h.invoke(job("nope"))).rejects.toThrow("NOT_FOUND");
  });
  test("a large backend reaches the runtime intact through descriptor 3", async () => {
    const padding = `/*${"x".repeat(300_000)}*/`;
    const h = host({ code: { server: `${SERVER_JS}\n${padding}`, migrations: null } });
    expect(await h.invoke(action("ping"))).toBe("pong");
  });
  test("no more than maxConcurrent invocations run at once", async () => {
    const h = host({ maxConcurrent: 2 });
    const peaks = await Promise.all([1, 2, 3, 4, 5].map(() => h.invoke(action("wait", "i1", 60))));
    expect(Math.max(...peaks.map(Number))).toBe(2);
  });
  test("stopping, going idle or timing out kills the runtime process", async () => {
    const stopped = host();
    const first = runtimeSelf(await stopped.invoke(action("self")));
    stopped.stop();
    expect(stopped.running).toBe(false);
    expect(await runtimeGone(first)).toBe(true);

    const idle = host({ idleMs: 50 });
    const second = runtimeSelf(await idle.invoke(action("self")));
    expect(await runtimeGone(second)).toBe(true);
    expect(idle.running).toBe(false);

    const slow = host({ timeoutMs: 200 });
    const third = runtimeSelf(await slow.invoke(action("self")));
    await expect(slow.invoke(action("hang"))).rejects.toThrow("TIMEOUT");
    expect(await runtimeGone(third)).toBe(true);
  });
  test("a refused start check never spawns the process", async () => {
    const h = host({
      beforeStart: async () => {
        throw new Error("TRUST_REQUIRED: tampered");
      },
    });
    await expect(h.invoke(action("ping"))).rejects.toThrow("TRUST_REQUIRED");
    expect(h.running).toBe(false);
  });
});
