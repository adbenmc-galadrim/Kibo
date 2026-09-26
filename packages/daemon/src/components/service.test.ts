import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ComponentCall,
  type Instance,
  KiboError,
  type TicketRun,
  type ValidationReport,
} from "@kibo/schema";
import {
  addInstance,
  boot,
  createProject,
  type Harness,
  type HarnessOptions,
  publishAndApprove,
  SANDBOX_ORIGIN,
  writeDraft,
} from "./service.test-helper";

let home: string;
let h: Harness;

const start = async (opts: HarnessOptions = {}) => {
  h = await boot(home, opts);
};
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-components-"));
  await start();
});
afterEach(async () => {
  await h.stop();
  rmSync(home, { recursive: true, force: true });
});

const callOf = (projectId: string, inst: Instance) => (c: ComponentCall) =>
  h.rpc({ method: "componentCall", projectId, instanceId: inst.id, call: c });
const events = () =>
  h.store.db
    .query<{ ref: string; kind: string; code: string; count: number }, []>(
      "SELECT ref, kind, code, count FROM component_events ORDER BY id",
    )
    .all();

describe("components over RPC", () => {
  test("a component run goes through the command path with its instance", async () => {
    const { projectId, pageId } = await createProject(h);
    const inst = await addInstance(h, projectId, pageId, "kanban@1.0.0");
    const seen: { method: string; instanceId: string | null }[] = [];
    h.service.commands.onCommand((e) =>
      seen.push({ method: e.command.method, instanceId: e.meta.instanceId }),
    );
    await callOf(projectId, inst)({ kind: "run", command: { method: "createTicket", title: "B" } });
    expect(seen).toEqual([{ method: "createTicket", instanceId: inst.id }]);
  });

  test("publish, approve, add, then calls are checked against the grant", async () => {
    const { projectId, pageId } = await createProject(h);
    await h.rpc({ method: "command", projectId, command: { method: "createTicket", title: "A" } });
    writeDraft(home, "0.1.0");
    expect((await h.rpc({ method: "previewPublish", id: "hello" })).status).toBe("new");
    const { hash } = await publishAndApprove(h);
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "hello@0.1.0"));
    expect(await call({ kind: "list", entity: "ticket" })).toHaveLength(1);
    await expect(call({ kind: "list", entity: "link" })).rejects.toThrow("PERMISSION_DENIED");
    await expect(call({ kind: "run", command: { method: "createTicket", title: "B" } })).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await call({ kind: "data.set", key: "k", value: { a: 1 } });
    expect(await call({ kind: "data.get", key: "k" })).toEqual({ a: 1 });
    expect(h.components.assets("hello", "0.1.0", hash)?.trust).toBe("sandboxed");
    expect(h.components.assets("hello", "0.1.0", "0".repeat(64))).toBeNull();
    expect(await h.rpc({ method: "getRuntimeInfo" })).toEqual({ sandboxOrigin: SANDBOX_ORIGIN });
  });

  test("assets are not served once the trust is withdrawn", async () => {
    writeDraft(home, "0.1.0");
    const { hash } = await publishAndApprove(h);
    await h.rpc({ method: "revokeComponent", id: "hello", version: "0.1.0" });
    expect(h.components.assets("hello", "0.1.0", hash)).toBeNull();
  });

  test("reserved commands cannot be sent through the command RPC", async () => {
    const { projectId, pageId } = await createProject(h);
    const inst = await addInstance(h, projectId, pageId, "kanban@1.0.0");
    const reserved = { method: "setInstanceData", instanceId: inst.id, key: "k", value: 1 } as const;
    expect(() => h.service.handle({ method: "command", projectId, command: reserved })).toThrow(
      "PERMISSION_DENIED",
    );
  });

  test("instance data is capped at 256 KiB and the refusal is journaled", async () => {
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0");
    await publishAndApprove(h);
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "hello@0.1.0"));
    await call({ kind: "data.set", key: "a", value: "x".repeat(200_000) });
    await expect(call({ kind: "data.set", key: "b", value: "x".repeat(70_000) })).rejects.toThrow(
      "QUOTA_EXCEEDED",
    );
    expect(events().map((e) => [e.ref, e.kind, e.code])).toEqual([
      ["hello@0.1.0", "data.set", "QUOTA_EXCEEDED"],
    ]);
  });

  test("a built-in component still goes through the private address guard", async () => {
    const { projectId, pageId } = await createProject(h);
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "kanban@1.0.0"));
    await expect(
      call({ kind: "fetch", url: "https://127.0.0.1/x", init: { method: "GET", headers: {} } }),
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("runs are listed through the gate with the run entity", async () => {
    await h.stop();
    const run: TicketRun = {
      ticketId: "t1",
      runId: "r1",
      label: "opus-dev",
      state: "running",
      position: null,
    };
    const asked: string[] = [];
    await start({
      runs: (projectId) => {
        asked.push(projectId);
        return [run];
      },
    });
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0", { reads: ["run"] });
    await publishAndApprove(h);
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "hello@0.1.0"));
    expect(await call({ kind: "list", entity: "run" })).toEqual([run]);
    expect(asked).toEqual([projectId]);
    await expect(call({ kind: "list", entity: "ticket" })).rejects.toThrow("PERMISSION_DENIED");
  });

  test("a navigating frame is journaled with its ref", async () => {
    const { projectId, pageId } = await createProject(h);
    const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
    const report = { method: "reportComponentRefusal", projectId, kind: "navigate" } as const;
    expect(await h.rpc({ ...report, instanceId: inst.id })).toBeNull();
    await expect(h.rpc({ ...report, instanceId: "ghost" })).rejects.toThrow("NOT_FOUND");
    expect(events()).toEqual([{ ref: "hello@0.1.0", kind: "navigate", code: "PERMISSION_DENIED", count: 1 }]);
  });

  test("refusals counted in memory are written when the daemon stops", async () => {
    const { projectId, pageId } = await createProject(h);
    const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
    for (let i = 0; i < 12; i += 1) {
      await h.rpc({ method: "reportComponentRefusal", projectId, instanceId: inst.id, kind: "navigate" });
    }
    await h.components.stop();
    expect(events().reduce((n, e) => n + e.count, 0)).toBe(12);
  });

  test("drafts are listed until published", async () => {
    writeDraft(home, "0.1.0");
    expect(await h.rpc({ method: "listDrafts" })).toHaveLength(1);
    await h.rpc({ method: "publishComponent", id: "hello", strategy: "new-version" });
    expect(await h.rpc({ method: "listDrafts" })).toEqual([]);
  });

  test("a manual publication is refused while an AI draft of the component is being finalized", async () => {
    writeDraft(home, "0.1.0");
    let release = () => {};
    const finalizing = h.components.publishLock.hold(
      "hello",
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const refused = h.rpc({ method: "publishComponent", id: "hello", strategy: "new-version" });
    await expect(refused).rejects.toMatchObject({ code: "CONFLICT" });
    release();
    await finalizing;
    expect(await h.rpc({ method: "publishComponent", id: "hello", strategy: "new-version" })).toMatchObject({
      version: { version: "0.1.0" },
    });
  });

  test("the registry and the publisher are shared with the AI", async () => {
    writeDraft(home, "0.1.0");
    const published = await h.components.publisher.publish("hello", "new-version", { origin: "ai" });
    expect(published.version.origin).toBe("ai");
    expect(h.components.registry.list().find((c) => c.id === "hello")?.versions[0]?.hash).toBe(
      published.version.hash,
    );
  });

  test("installing the command line is left to the desktop app", async () => {
    await expect(h.rpc({ method: "installCli" })).rejects.toThrow("INVALID_INPUT");
    await expect(h.rpc({ method: "cliStatus" })).rejects.toThrow("INVALID_INPUT");
  });

  test("the command line status comes from the desktop app", async () => {
    await h.stop();
    const status = { path: "/Users/adam/.local/bin/kibo", installed: true };
    await start({ cliStatus: async () => status });
    expect(await h.rpc({ method: "cliStatus" })).toEqual(status);
  });
});

describe("notes", () => {
  test("notes RPCs and the built-in notes component share the same folder", async () => {
    const { projectId, pageId } = await createProject(h);
    const info = await h.rpc({ method: "getNotesDir", projectId });
    expect(info.dir).toBe(join(home, "notes", "KIB"));
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "notes@1.0.0"));
    await call({ kind: "notes.write", path: "a.md", markdown: "# A", expectedMtime: null });
    expect(await call({ kind: "list", entity: "note" })).toHaveLength(1);
    await expect(h.rpc({ method: "getNotesDir", projectId: "ghost" })).rejects.toThrow("NOT_FOUND");
  });

  test("the notes folder must be an existing absolute folder", async () => {
    const { projectId } = await createProject(h);
    const set = (dir: string) => h.rpc({ method: "setNotesDir", projectId, dir });
    await expect(set("relative/notes")).rejects.toThrow("INVALID_INPUT");
    await expect(set(join(home, "missing"))).rejects.toThrow("INVALID_INPUT");
    const dir = join(home, "vault");
    mkdirSync(dir);
    expect((await set(dir)).dir).toBe(dir);
    expect((await h.rpc({ method: "getNotesDir", projectId })).dir).toBe(dir);
  });

  test("every project is indexed when the daemon starts", async () => {
    await createProject(h);
    await h.stop();
    mkdirSync(join(home, "notes", "KIB"), { recursive: true });
    writeFileSync(join(home, "notes", "KIB", "offline.md"), "# Écrite hors ligne");
    await start();
    const rows = h.store.db.query<{ path: string }, []>("SELECT path FROM notes").all();
    expect(rows).toEqual([{ path: "offline.md" }]);
  });
});

type Validation = { signal: AbortSignal; fail(e: unknown): void };

function suspendedValidation() {
  const seen: Validation[] = [];
  const validate = (_dir: string, signal: AbortSignal) =>
    new Promise<ValidationReport>((_resolve, fail) => {
      seen.push({ signal, fail });
    });
  return { seen, validate };
}

const settledWithin = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.then(() => true), Bun.sleep(ms).then(() => false)]);

describe("stopping", () => {
  test("stop waits for a request in flight and aborts its validation", async () => {
    const suspended = suspendedValidation();
    await h.stop();
    await start({ validate: suspended.validate });
    writeDraft(home, "0.1.0");
    const errors = spyOn(console, "error");
    const publish = h.components.handle({ method: "publishComponent", id: "hello", strategy: "new-version" });
    const outcome = publish.then(
      () => "resolved",
      (e: unknown) => (e instanceof KiboError ? e.code : String(e)),
    );
    while (suspended.seen.length === 0) await Bun.sleep(5);
    const stopping = h.components.stop();
    expect(await settledWithin(stopping, 50)).toBe(false);
    const [validation] = suspended.seen;
    expect(validation?.signal.aborted).toBe(true);
    validation?.fail(new KiboError("INTERNAL", "validation aborted"));
    await stopping;
    expect(await outcome).toBe("INTERNAL");
    const logged = errors.mock.calls.flat().map(String);
    errors.mockRestore();
    expect(logged.filter((m) => m.includes("closed"))).toEqual([]);
  });

  test("a request after stop is refused at once", async () => {
    await h.components.stop();
    const refused = h.components.handle({ method: "listComponents" });
    await expect(refused).rejects.toThrow("the daemon is stopping");
    await expect(refused).rejects.toMatchObject({ code: "INTERNAL" });
  });

  test("a request that never ends only delays the stop by drainMs", async () => {
    const suspended = suspendedValidation();
    await h.stop();
    await start({ validate: suspended.validate, drainMs: 50 });
    writeDraft(home, "0.1.0");
    const errors = spyOn(console, "error").mockImplementation(() => undefined);
    h.components.handle({ method: "publishComponent", id: "hello", strategy: "new-version" });
    while (suspended.seen.length === 0) await Bun.sleep(5);
    const started = Date.now();
    await h.components.stop();
    const elapsed = Date.now() - started;
    const logged = errors.mock.calls.flat().map(String);
    errors.mockRestore();
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(1_000);
    expect(logged).toContain("[kibo-daemon] 1 requests still running at shutdown");
  });
});
