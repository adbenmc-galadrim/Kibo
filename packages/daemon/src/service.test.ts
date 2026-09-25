import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta, ProjectSnapshot, ProjectSummary, Ticket } from "@kibo/schema";
import { createService } from "./service";
import { openStore } from "./store";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-svc-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const newProject = {
  method: "createProject",
  name: "Kibo",
  key: "KIB",
  folder: null,
  color: "#F97316",
} as const;

describe("service", () => {
  test("lists projects with their ticket counts by status", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    s.handle({ method: "command", projectId: p.id, command: { method: "createTicket", title: "A" } });
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title: "B", statusId: "in_progress" },
    });
    const [summary] = s.handle({ method: "listProjects" }) as ProjectSummary[];
    expect(summary).toEqual({
      ...p,
      counts: { backlog: 0, todo: 1, in_progress: 1, in_review: 0, blocked: 0, done: 0 },
    });
    store.close();
  });

  test("keys stay unique and continue after a restart", () => {
    const home = tmp();
    const store1 = openStore(home);
    const s1 = createService(store1, { user: "adam" });
    const p = s1.handle(newProject) as ProjectMeta;
    for (let i = 0; i < 50; i++) {
      s1.handle({ method: "command", projectId: p.id, command: { method: "createTicket", title: `T${i}` } });
    }
    store1.close();

    const store2 = openStore(home);
    const s2 = createService(store2, { user: "adam" });
    const t = s2.handle({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title: "next" },
    }) as Ticket;
    expect(t.key).toBe("KIB-51");
    const snap = s2.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot;
    expect(new Set(snap.tickets.map((x) => x.key)).size).toBe(51);
    store2.close();
  });

  test("notifies listeners of what changed", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const seen: (string | null)[] = [];
    const off = s.onChange((id) => seen.push(id));
    const p = s.handle(newProject) as ProjectMeta;
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "addPage", title: "Kanban", kind: "view" },
    });
    off();
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "addPage", title: "Notes", kind: "view" },
    });
    expect(seen).toEqual([null, p.id]);
    store.close();
  });

  test("reports unknown projects and exposes the session", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    expect(s.handle({ method: "getSession" })).toEqual({ user: "adam" });
    expect(() => s.handle({ method: "getProject", projectId: "nope" })).toThrow("NOT_FOUND");
    store.close();
  });
});
