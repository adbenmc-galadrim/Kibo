import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ComponentCall, INBOX_ID, type Instance } from "@kibo/schema";
import { addInstance, boot, createProject, type Harness, type HarnessOptions } from "./service.test-helper";

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
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "kanban@1.0.0"));
    await call({ kind: "data.set", key: "a", value: "x".repeat(200_000) });
    await expect(call({ kind: "data.set", key: "b", value: "x".repeat(70_000) })).rejects.toThrow(
      "QUOTA_EXCEEDED",
    );
    expect(events().map((e) => [e.ref, e.kind, e.code])).toEqual([
      ["kanban@1.0.0", "data.set", "QUOTA_EXCEEDED"],
    ]);
  });

  test("a built-in component still goes through the private address guard", async () => {
    const { projectId, pageId } = await createProject(h);
    const call = callOf(projectId, await addInstance(h, projectId, pageId, "kanban@1.0.0"));
    await expect(
      call({ kind: "fetch", url: "https://127.0.0.1/x", init: { method: "GET", headers: {} } }),
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("a call for a non-builtin ref is refused with NOT_FOUND and journaled", async () => {
    const { projectId, pageId } = await createProject(h);
    for (const ref of ["hello@0.1.0", "notes@1.0.0", "tickets@1.0.0"]) {
      const call = callOf(projectId, await addInstance(h, projectId, pageId, ref));
      await expect(call({ kind: "list", entity: "ticket" })).rejects.toThrow("NOT_FOUND");
    }
    expect(events().map((e) => e.ref)).toEqual(["hello@0.1.0", "notes@1.0.0", "tickets@1.0.0"]);
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
  test("the notes folder of a project is read over RPC", async () => {
    const { projectId } = await createProject(h);
    const info = await h.rpc({ method: "getNotesDir", projectId });
    expect(info.dir).toBe(join(home, "notes", "KIB"));
    await expect(h.rpc({ method: "getNotesDir", projectId: "ghost" })).rejects.toThrow("NOT_FOUND");
  });

  test("listNotes reads the notes index without a component instance", async () => {
    const { projectId } = await createProject(h);
    const dir = join(home, "notes", "KIB", "briefs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "C1-3.md"), "# Brief");
    const notes = await h.rpc({ method: "listNotes", projectId });
    expect(notes.map((n) => [n.path, n.title])).toEqual([["briefs/C1-3.md", "Brief"]]);
    await expect(h.rpc({ method: "listNotes", projectId: INBOX_ID })).rejects.toThrow(
      "notes is not available for the inbox",
    );
  });

  test("the inbox has no notes folder to read or set", async () => {
    const dir = join(home, "vault-inbox");
    mkdirSync(dir);
    await expect(h.rpc({ method: "getNotesDir", projectId: INBOX_ID })).rejects.toThrow(
      "notes is not available for the inbox",
    );
    await expect(h.rpc({ method: "setNotesDir", projectId: INBOX_ID, dir })).rejects.toThrow(
      "notes is not available for the inbox",
    );
    const rows = h.store.db
      .query<{ n: number }, []>("SELECT count(*) AS n FROM project_settings WHERE project_id = 'inbox'")
      .all();
    expect(rows).toEqual([{ n: 0 }]);
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

  test("a removed project leaves the notes index", async () => {
    const { projectId } = await createProject(h);
    mkdirSync(join(home, "notes", "KIB"), { recursive: true });
    writeFileSync(join(home, "notes", "KIB", "a.md"), "# A");
    await h.rpc({ method: "listNotes", projectId });
    const rows = () => h.store.db.query<{ path: string }, []>("SELECT path FROM notes").all();
    expect(rows()).toEqual([{ path: "a.md" }]);
    h.service.docs.removeProject(projectId);
    expect(rows()).toEqual([]);
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

const settledWithin = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.then(() => true), Bun.sleep(ms).then(() => false)]);

function suspendedStatus() {
  let release = () => {};
  let asked = false;
  const cliStatus = () =>
    new Promise<{ path: string; installed: boolean }>((resolve) => {
      asked = true;
      release = () => resolve({ path: "/usr/local/bin/kibo", installed: true });
    });
  return { cliStatus, asked: () => asked, release: () => release() };
}

describe("stopping", () => {
  test("stop waits for a request in flight", async () => {
    const suspended = suspendedStatus();
    await h.stop();
    await start({ cliStatus: suspended.cliStatus });
    const status = h.components.handle({ method: "cliStatus" });
    while (!suspended.asked()) await Bun.sleep(5);
    const stopping = h.components.stop();
    expect(await settledWithin(stopping, 50)).toBe(false);
    suspended.release();
    await stopping;
    expect(await status).toEqual({ path: "/usr/local/bin/kibo", installed: true });
  });

  test("a request after stop is refused at once", async () => {
    await h.components.stop();
    const refused = h.components.handle({ method: "cliStatus" });
    await expect(refused).rejects.toThrow("the daemon is stopping");
    await expect(refused).rejects.toMatchObject({ code: "INTERNAL" });
  });

  test("a request that never ends only delays the stop by drainMs", async () => {
    const suspended = suspendedStatus();
    await h.stop();
    await start({ cliStatus: suspended.cliStatus, drainMs: 50 });
    const errors = spyOn(console, "error").mockImplementation(() => undefined);
    h.components.handle({ method: "cliStatus" });
    while (!suspended.asked()) await Bun.sleep(5);
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
