import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  enableServerAllocation,
  listProjectDomainGuidelines,
  listProjectDomains,
  listTickets,
} from "@kibo/core";
import { listDomains, listGuidelines } from "@kibo/core/agent-config";
import { Domain, KiboError, type ProjectMeta, type Ticket } from "@kibo/schema";
import type { Docs } from "../docs";
import { call, createService } from "../service";
import { openStore } from "../store";
import { migrateDomainScopes } from "./domain-scope-migration";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

const color = "#14B8A6";
const NOW = Date.parse("2026-10-12T08:00:00Z");

function open(home: string, readOnlyClient = true) {
  const store = openStore(home);
  const s = createService(store, { user: "adam" });
  s.docs.setWriteGuard((id) => {
    if (readOnlyClient && s.docs.projectMeta(id).name === "Client") {
      throw new KiboError("FORBIDDEN", `project ${id} is read-only`);
    }
  });
  const saves: (string | null)[] = [];
  const docs: Docs = {
    ...s.docs,
    save: (id) => {
      saves.push(id);
      s.docs.save(id);
    },
  };
  const lines: string[] = [];
  const migrate = () => migrateDomainScopes({ docs, log: (line) => lines.push(line), now: () => NOW });
  return { store, s, saves, lines, migrate };
}

function seed() {
  const home = mkdtempSync(join(tmpdir(), "kibo-domain-scopes-"));
  homes.push(home);
  const { store, s } = open(home, false);
  const project = (name: string, key: string): ProjectMeta =>
    call(s, { method: "createProject", name, key, folder: null, color: "#F97316" });
  const a = project("Kibo", "KIB");
  const b = project("Portail", "POR");
  const c = project("Client", "CLI");
  const ws = s.docs.workspace;
  const legacyDomain = (name: string): Domain => {
    const d = Domain.parse({ id: crypto.randomUUID(), name, color });
    ws.getMap("domains").set(d.id, { id: d.id, name, color });
    return d;
  };
  const [d1, d2, d3, d4, d5] = ["Sync", "Sécurité", "Vide", "Client", "Boutique"].map(legacyDomain);
  if (!d1 || !d2 || !d3 || !d4 || !d5) throw new Error("domains not created");
  const legacyFile = (d: Domain, path: string) =>
    ws.getMap("guidelines").set(`g-${path}`, {
      id: `g-${path}`,
      owner: { scope: "domain", domainId: d.id },
      path,
      content: path,
    });
  legacyFile(d1, "sync.md");
  legacyFile(d1, "loro.md");
  legacyFile(d5, "boutique.md");
  ws.commit();
  s.docs.save(null);
  s.handle({
    method: "config",
    command: { method: "addGuideline", owner: { scope: "workspace" }, path: "conventions.md", content: "c" },
  });
  const ticket = (p: ProjectMeta, d: Domain) => {
    const t = s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title: "T" },
    }) as Ticket;
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "updateTicket", ticketId: t.id, domainId: d.id },
    });
  };
  ticket(a, d1);
  ticket(a, d1);
  ticket(a, d2);
  ticket(b, d2);
  ticket(c, d4);
  ticket(b, d5);
  const shop = s.docs.project(b.id);
  shop.getMap("projectDomains").set(d5.id, { name: "Boutique (copie)", color, guidelines: [] });
  shop.commit();
  s.docs.save(b.id);
  enableServerAllocation(s.docs.project(c.id));
  s.docs.save(c.id);
  store.close();
  return { home, a, b, c, d1, d2, d3, d4, d5 };
}

const domainIds = (s: ReturnType<typeof open>["s"], projectId: string) =>
  listProjectDomains(s.docs.project(projectId)).map((d) => d.id);

test("moves a domain used by one writable project only, keeps the others, logs every domain", async () => {
  const { home, a, b, c, d1, d2, d3, d4, d5 } = seed();
  const { store, s, lines, migrate } = open(home);
  const ticketsBefore = [a, b, c].map((p) => listTickets(s.docs.project(p.id)));
  expect(await migrate()).toEqual({ moved: 2, kept: 3 });
  expect(
    listDomains(s.docs.workspace)
      .map((d) => d.id)
      .sort(),
  ).toEqual([d2.id, d3.id, d4.id].sort());
  expect(listGuidelines(s.docs.workspace).map((g) => g.path)).toEqual(["conventions.md"]);
  expect(domainIds(s, a.id)).toEqual([d1.id]);
  expect(listProjectDomainGuidelines(s.docs.project(a.id)).map((g) => [g.path, g.content, g.owner])).toEqual([
    ["loro.md", "loro.md", { scope: "domain", domainId: d1.id, projectId: a.id }],
    ["sync.md", "sync.md", { scope: "domain", domainId: d1.id, projectId: a.id }],
  ]);
  expect(listProjectDomains(s.docs.project(b.id))).toEqual([
    { id: d5.id, name: "Boutique (copie)", color, owner: { scope: "project", projectId: b.id } },
  ]);
  expect(domainIds(s, c.id)).toEqual([]);
  expect([a, b, c].map((p) => listTickets(s.docs.project(p.id)))).toEqual(ticketsBefore);
  expect(s.docs.workspace.getMap("settings").get("domainsScopedAt")).toBe("2026-10-12T08:00:00.000Z");
  expect(lines.sort()).toEqual(
    [
      'domain "Sync" moved to project "Kibo"',
      'domain "Sécurité" kept in the workspace: used by 2 projects',
      'domain "Vide" kept in the workspace: unused',
      'domain "Client" kept in the workspace: project "Client" is read-only',
      'domain "Boutique" removed from the workspace: project "Portail" already has it',
    ].sort(),
  );
  store.close();

  const restarted = open(home);
  expect(
    listDomains(restarted.s.docs.workspace)
      .map((d) => d.id)
      .sort(),
  ).toEqual([d2.id, d3.id, d4.id].sort());
  expect(domainIds(restarted.s, a.id)).toEqual([d1.id]);
  expect(await restarted.migrate()).toBeNull();
  expect(restarted.saves).toEqual([]);
  expect(restarted.lines).toEqual([]);
  restarted.store.close();
});

test("the project is saved before the workspace, the workspace once", async () => {
  const { home, a, b } = seed();
  const { store, saves, migrate } = open(home);
  await migrate();
  expect(saves.sort()).toEqual([a.id, b.id, null].sort());
  expect(saves.at(-1)).toBeNull();
  store.close();
});

test("an instance without domains is only marked", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-domain-scopes-"));
  homes.push(home);
  const { store, saves, lines, migrate } = open(home);
  expect(await migrate()).toEqual({ moved: 0, kept: 0 });
  expect(saves).toEqual([null]);
  expect(lines).toEqual([]);
  expect(await migrate()).toBeNull();
  store.close();
});
