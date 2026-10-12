import { describe, expect, test } from "bun:test";
import type { Domain, DomainOwner, Guideline, Instance, Page } from "@kibo/schema";
import type { DesiredGuideline, DesiredPage, ResolvedIds } from "./desired";
import {
  componentRefs,
  knownDomains,
  missingDomains,
  missingInstances,
  missingPages,
  planGuidelines,
  planTickets,
} from "./plan";

const domain = (id: string, name: string, owner: DomainOwner = { scope: "workspace" }): Domain => ({
  id,
  name,
  color: "#14B8A6",
  owner,
});
const page = (id: string, title: string, parentId: string | null = null): Page => ({
  id,
  title,
  kind: "view",
  parentId,
});
const instance = (pageId: string, component: string): Instance => ({
  id: `i-${pageId}-${component}`,
  pageId,
  component,
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
  componentHash: null,
});
const ids: ResolvedIds = {
  projectId: "p1",
  domains: new Map([
    ["Sync", "d1"],
    ["Sécurité", "d2"],
  ]),
  workspaceDomains: new Set(["d2"]),
};

describe("knownDomains", () => {
  test("the project domains, then the workspace ones, never another project's", () => {
    const inP1 = { scope: "project", projectId: "p1" } as const;
    const sync = domain("d1", "Sync", inP1);
    const securite = domain("d2", "Sécurité");
    const other = domain("d3", "Sync", { scope: "project", projectId: "p2" });
    const shadowed = domain("d4", "Sync");
    expect(knownDomains([securite, other, shadowed, sync], "p1")).toEqual({
      list: [sync, securite, shadowed],
      ids: {
        projectId: "p1",
        domains: new Map([
          ["Sync", "d1"],
          ["Sécurité", "d2"],
        ]),
        workspaceDomains: new Set(["d2", "d4"]),
      },
    });
  });
});

describe("missingDomains", () => {
  test("adds the absent domains with the palette color that follows the existing ones", () => {
    const existing = [domain("d1", "Sync")];
    const desired = [
      { name: "Sync", guideline: "" },
      { name: "UI", guideline: "" },
      { name: "CI", guideline: "" },
    ];
    expect(missingDomains(existing, desired)).toEqual([
      { name: "UI", color: "#6366F1" },
      { name: "CI", color: "#EC4899" },
    ]);
  });
});

describe("planGuidelines", () => {
  const desired: DesiredGuideline[] = [
    { owner: { scope: "workspace" }, path: "conventions.md", content: "A" },
    { owner: { scope: "project" }, path: "kibo.md", content: "B" },
    { owner: { scope: "domain", name: "Sync" }, path: "sync.md", content: "C" },
    { owner: { scope: "domain", name: "Absent" }, path: "absent.md", content: "D" },
  ];

  test("a guideline of a workspace domain keeps a workspace owner", () => {
    const securite = { owner: { scope: "domain", name: "Sécurité" }, path: "s.md", content: "S" } as const;
    expect(planGuidelines([], [securite], ids).add).toEqual([
      { owner: { scope: "domain", domainId: "d2", projectId: null }, path: "s.md", content: "S" },
    ]);
  });

  test("adds every resolvable guideline on an empty workspace", () => {
    const plan = planGuidelines([], desired, ids);
    expect(plan.add.map((g) => [g.owner, g.path])).toEqual([
      [{ scope: "workspace" }, "conventions.md"],
      [{ scope: "project", projectId: "p1" }, "kibo.md"],
      [{ scope: "domain", domainId: "d1", projectId: "p1" }, "sync.md"],
    ]);
    expect(plan.unresolved).toEqual(["domain Absent: absent.md"]);
  });

  test("never rewrites an existing guideline and reports a changed content", () => {
    const existing: Guideline[] = [
      { id: "g1", owner: { scope: "workspace" }, path: "conventions.md", content: "A" },
      { id: "g2", owner: { scope: "project", projectId: "p1" }, path: "kibo.md", content: "edited" },
    ];
    const plan = planGuidelines(existing, desired.slice(0, 2), ids);
    expect(plan.add).toEqual([]);
    expect(plan.drift).toEqual(["project: kibo.md"]);
  });

  test("finds a guideline moved with its domain into the project", () => {
    const existing: Guideline[] = [
      {
        id: "d1:sync.md",
        owner: { scope: "domain", domainId: "d1", projectId: "p1" },
        path: "sync.md",
        content: "C",
      },
    ];
    expect(planGuidelines(existing, desired.slice(2, 3), ids)).toEqual({
      add: [],
      drift: [],
      unresolved: [],
    });
  });

  test("does not match a guideline of another project", () => {
    const existing: Guideline[] = [
      { id: "g2", owner: { scope: "project", projectId: "other" }, path: "kibo.md", content: "B" },
    ];
    expect(planGuidelines(existing, desired.slice(1, 2), ids).add).toHaveLength(1);
  });
});

describe("pages and instances", () => {
  const desired: DesiredPage[] = [
    { title: "Kanban", kind: "view", instances: [{ componentId: "kanban", config: {} }] },
    {
      title: "Tableau de bord",
      kind: "dashboard",
      instances: [
        { componentId: "kanban", config: {}, layout: { x: 0, y: 0, w: 6, h: 6 } },
        { componentId: "graph", config: {}, layout: { x: 6, y: 0, w: 6, h: 6 } },
      ],
    },
  ];
  const refs = new Map([
    ["kanban", "kanban@1.0.0"],
    ["graph", "graph@1.0.0"],
  ]);

  test("adds only the top-level pages whose title is absent", () => {
    const pages = [page("a", "Kanban"), page("b", "Tableau de bord", "a")];
    expect(missingPages(pages, desired).map((p) => p.title)).toEqual(["Tableau de bord"]);
  });

  test("adds the instances a page lacks, whatever their version", () => {
    const pages = [page("a", "Kanban"), page("b", "Tableau de bord")];
    const plan = missingInstances({ pages, instances: [instance("b", "kanban@0.9.0")] }, desired, refs);
    expect(plan.add).toEqual([
      { pageId: "a", component: "kanban@1.0.0", config: {} },
      { pageId: "b", component: "graph@1.0.0", config: {}, layout: { x: 6, y: 0, w: 6, h: 6 } },
    ]);
  });

  test("reports a component without a known version", () => {
    const plan = missingInstances(
      { pages: [page("a", "Kanban")], instances: [] },
      desired.slice(0, 1),
      new Map(),
    );
    expect(plan).toEqual({ add: [], unresolved: ["Kanban: kanban"] });
  });
});

describe("planTickets", () => {
  const desired = [
    { title: "Existant", description: "", domain: "Sync" },
    { title: "Nouveau", description: "d", domain: "Sync" },
    { title: "Sans domaine", description: "", domain: null },
    { title: "Domaine inconnu", description: "", domain: "Absent" },
  ];

  test("creates the absent tickets and fills an empty domain of an existing one", () => {
    const plan = planTickets([{ id: "t1", title: "Existant", domainId: null }], desired, ids.domains);
    expect(plan.create.map((t) => [t.title, t.domainId])).toEqual([
      ["Nouveau", "d1"],
      ["Sans domaine", null],
      ["Domaine inconnu", null],
    ]);
    expect(plan.setDomain).toEqual([{ ticketId: "t1", domainId: "d1" }]);
    expect(plan.unresolved).toEqual(["Domaine inconnu: domain Absent"]);
  });

  test("leaves a domain chosen by hand", () => {
    const plan = planTickets(
      [{ id: "t1", title: "Existant", domainId: "d9" }],
      desired.slice(0, 1),
      ids.domains,
    );
    expect(plan).toEqual({ create: [], setDomain: [], unresolved: [] });
  });
});

describe("componentRefs", () => {
  const summary = (id: string, versions: string[]) => ({
    id,
    versions: versions.map((version) => ({ version })),
  });

  test("prefers the highest installed version, else the manifest of the repository", () => {
    const refs = componentRefs(
      [summary("kanban", ["1.0.0", "1.2.0", "1.10.0"]), summary("notes", [])],
      new Map([
        ["notes", "1.0.0"],
        ["graph", "2.0.0"],
      ]),
    );
    expect(Object.fromEntries(refs)).toEqual({
      kanban: "kanban@1.10.0",
      notes: "notes@1.0.0",
      graph: "graph@2.0.0",
    });
  });
});
