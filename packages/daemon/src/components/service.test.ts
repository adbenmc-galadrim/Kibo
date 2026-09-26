import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComponentCall, Instance, TicketRun } from "@kibo/schema";
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
afterEach(() => {
  h.stop();
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
    h.stop();
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
    h.components.stop();
    expect(events().reduce((n, e) => n + e.count, 0)).toBe(12);
  });

  test("drafts are listed until published", async () => {
    writeDraft(home, "0.1.0");
    expect(await h.rpc({ method: "listDrafts" })).toHaveLength(1);
    await h.rpc({ method: "publishComponent", id: "hello", strategy: "new-version" });
    expect(await h.rpc({ method: "listDrafts" })).toEqual([]);
  });

  test("installing the command line is left to the desktop app", async () => {
    await expect(h.rpc({ method: "installCli" })).rejects.toThrow("INVALID_INPUT");
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
    h.stop();
    mkdirSync(join(home, "notes", "KIB"), { recursive: true });
    writeFileSync(join(home, "notes", "KIB", "offline.md"), "# Écrite hors ligne");
    await start();
    const rows = h.store.db.query<{ path: string }, []>("SELECT path FROM notes").all();
    expect(rows).toEqual([{ path: "offline.md" }]);
  });
});
