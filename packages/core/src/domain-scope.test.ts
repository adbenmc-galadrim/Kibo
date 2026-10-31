import { describe, expect, test } from "bun:test";
import { type ConfigCommand, Domain } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { executeConfigCommand, listDomains, listGuidelines } from "./agent-config";
import { applyDomainMove, domainsOf, planDomainScopes } from "./domain-scope";
import { createTicket, listTickets } from "./index";
import { createProjectDoc } from "./project";
import { listProjectDomainGuidelines, listProjectDomains } from "./project-domains";
import { createWorkspaceDoc } from "./workspace";

const color = "#14B8A6";
const domain = (id: string) => Domain.parse({ id, name: id.toUpperCase(), color });
const usage = (entries: Record<string, Record<string, number>>) =>
  new Map(Object.entries(entries).map(([d, byProject]) => [d, new Map(Object.entries(byProject))]));

describe("domainsOf", () => {
  test("the project then the workspace", () => {
    const own = Domain.parse({ id: "p", name: "Sync", color, owner: { scope: "project", projectId: "a" } });
    const ws = [domain("w")];
    expect(domainsOf({ project: { domains: [own] }, workspace: ws })).toEqual([own, ...ws]);
  });
});

describe("planDomainScopes", () => {
  test("moves a domain used by one project, keeps every other case", () => {
    const plan = planDomainScopes(
      [domain("d1"), domain("d2"), domain("d3"), domain("d4")],
      usage({ d1: { a: 3 }, d2: { a: 1, b: 2 }, d4: { b: 5 } }),
    );
    expect(plan).toEqual({
      move: [
        { domainId: "d1", projectId: "a" },
        { domainId: "d4", projectId: "b" },
      ],
      keep: [
        { domainId: "d2", reason: "shared" },
        { domainId: "d3", reason: "unused" },
      ],
    });
  });

  test("a project with zero tickets on the domain does not count", () => {
    const plan = planDomainScopes([domain("d1")], usage({ d1: { a: 0, b: 2 } }));
    expect(plan.move).toEqual([{ domainId: "d1", projectId: "b" }]);
  });

  test("project domains are never planned", () => {
    const own = Domain.parse({ id: "p", name: "P", color, owner: { scope: "project", projectId: "a" } });
    expect(planDomainScopes([own], usage({ p: { a: 1 } }))).toEqual({ move: [], keep: [] });
  });
});

const run = (doc: LoroDoc, cmd: ConfigCommand) => executeConfigCommand(doc, cmd);
const projectDoc = (id: string) =>
  createProjectDoc({
    id,
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });

function workspaceWithSync() {
  const ws = createWorkspaceDoc();
  const sync = run(ws, { method: "createDomain", domain: { name: "Sync", color } }) as Domain;
  const owner = { scope: "domain", domainId: sync.id, projectId: null } as const;
  run(ws, { method: "addGuideline", owner, path: "sync.md", content: "# Sync" });
  run(ws, { method: "addGuideline", owner: { scope: "workspace" }, path: "general.md", content: "g" });
  return { ws, sync };
}

describe("applyDomainMove", () => {
  test("copies the domain and its guidelines into the project, then removes it from the workspace", () => {
    const { ws, sync } = workspaceWithSync();
    const doc = projectDoc("a");
    const ticket = createTicket(doc, { title: "T", domainId: sync.id });
    applyDomainMove(ws, doc, "a", sync.id);
    expect(listDomains(ws)).toEqual([]);
    expect(listGuidelines(ws).map((g) => g.path)).toEqual(["general.md"]);
    expect(listProjectDomains(doc)).toEqual([{ ...sync, owner: { scope: "project", projectId: "a" } }]);
    expect(listProjectDomainGuidelines(doc)).toEqual([
      {
        id: `${sync.id}:sync.md`,
        owner: { scope: "domain", domainId: sync.id, projectId: "a" },
        path: "sync.md",
        content: "# Sync",
      },
    ]);
    expect(listTickets(doc).find((t) => t.id === ticket.id)?.domainId).toBe(sync.id);
  });

  test("an existing project copy is kept as is", () => {
    const { ws, sync } = workspaceWithSync();
    const doc = projectDoc("a");
    doc.getMap("projectDomains").set(sync.id, { name: "Sync partagé", color, guidelines: [] });
    doc.commit();
    applyDomainMove(ws, doc, "a", sync.id);
    expect(listDomains(ws)).toEqual([]);
    expect(listProjectDomains(doc).map((d) => d.name)).toEqual(["Sync partagé"]);
    expect(listProjectDomainGuidelines(doc)).toEqual([]);
  });

  test("refuses a project doc that is not the named project, or an unknown domain", () => {
    const { ws, sync } = workspaceWithSync();
    expect(() => applyDomainMove(ws, projectDoc("b"), "a", sync.id)).toThrow("INVALID_INPUT");
    expect(() => applyDomainMove(ws, projectDoc("a"), "a", "nope")).toThrow("NOT_FOUND");
    expect(listDomains(ws)).toHaveLength(1);
  });
});
