import { describe, expect, test } from "bun:test";
import { ConfigCommand, type Domain, type Guideline } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import {
  dropProfiles,
  executeConfigCommand,
  listDomains,
  listGuidelines,
  workspaceDescription,
  workspaceName,
} from "./agent-config";
import { createProjectDoc } from "./project";
import { listProjectDomainGuidelines, listProjectDomains } from "./project-domains";
import { createWorkspaceDoc } from "./workspace";

const run = <T>(doc: LoroDoc, cmd: ConfigCommand) => executeConfigCommand(doc, cmd) as T;
const project = (id = "p1") =>
  createProjectDoc({
    id,
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
  });

describe("domains", () => {
  test("names are unique regardless of case, deleting one drops its guidelines", () => {
    const ws = createWorkspaceDoc();
    const core = run<Domain>(ws, { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } });
    expect(() => run(ws, { method: "createDomain", domain: { name: "core", color: "#6366F1" } })).toThrow(
      "INVALID_INPUT",
    );
    run(ws, { method: "updateDomain", domainId: core.id, patch: { name: "Noyau" } });
    expect(listDomains(ws).map((d) => d.name)).toEqual(["Noyau"]);
    run(ws, {
      method: "addGuideline",
      owner: { scope: "domain", domainId: core.id, projectId: null },
      path: "guidelines/core.md",
      content: "# Core",
    });
    run(ws, { method: "deleteDomain", domainId: core.id });
    expect(listDomains(ws)).toEqual([]);
    expect(listGuidelines(ws)).toEqual([]);
  });

  test("concurrent creations on two replicas both survive the merge", () => {
    const a = createWorkspaceDoc();
    const b = LoroDoc.fromSnapshot(a.export({ mode: "snapshot" }));
    run(a, { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } });
    run(b, { method: "createDomain", domain: { name: "UI", color: "#EC4899" } });
    a.import(b.export({ mode: "update", from: a.oplogVersion() }));
    expect(listDomains(a).map((d) => d.name)).toEqual(["Core", "UI"]);
  });
});

describe("guidelines", () => {
  test("workspace and domain guidelines live in the workspace doc", () => {
    const ws = createWorkspaceDoc();
    const d = run<Domain>(ws, { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } });
    run(ws, { method: "addGuideline", owner: { scope: "workspace" }, path: "general.md", content: "a" });
    run(ws, {
      method: "addGuideline",
      owner: { scope: "domain", domainId: d.id, projectId: null },
      path: "core.md",
      content: "b",
    });
    expect(
      listGuidelines(ws)
        .map((g) => g.owner.scope)
        .sort(),
    ).toEqual(["domain", "workspace"]);
    expect(() =>
      run(ws, {
        method: "addGuideline",
        owner: { scope: "domain", domainId: "nope", projectId: null },
        path: "x.md",
        content: "",
      }),
    ).toThrow("NOT_FOUND");
  });

  test("project guidelines live in their own project doc", () => {
    const doc = project();
    const owner = { scope: "project", projectId: "p1" } as const;
    const g = run<Guideline>(doc, {
      method: "addGuideline",
      owner,
      path: "guidelines/kibo.md",
      content: "# Kibo",
    });
    expect(listGuidelines(doc)).toEqual([g]);
    expect(() =>
      run(doc, {
        method: "addGuideline",
        owner: { scope: "project", projectId: "p2" },
        path: "x.md",
        content: "",
      }),
    ).toThrow("INVALID_INPUT");
    expect(() =>
      run(createWorkspaceDoc(), { method: "addGuideline", owner, path: "x.md", content: "" }),
    ).toThrow("INVALID_INPUT");
  });

  test("paths are unique per owner; update and remove need the right owner", () => {
    const ws = createWorkspaceDoc();
    const owner = { scope: "workspace" } as const;
    const g = run<Guideline>(ws, { method: "addGuideline", owner, path: "a.md", content: "1" });
    run(ws, { method: "addGuideline", owner, path: "b.md", content: "2" });
    expect(() => run(ws, { method: "addGuideline", owner, path: "a.md", content: "3" })).toThrow(
      "INVALID_INPUT",
    );
    expect(() => run(ws, { method: "updateGuideline", owner, guidelineId: g.id, path: "b.md" })).toThrow(
      "INVALID_INPUT",
    );
    const edited = run<Guideline>(ws, {
      method: "updateGuideline",
      owner,
      guidelineId: g.id,
      content: "# A",
    });
    expect(edited).toEqual({ ...g, content: "# A" });
    const wrong = { scope: "domain", domainId: "x", projectId: null } as const;
    expect(() => run(ws, { method: "removeGuideline", owner: wrong, guidelineId: g.id })).toThrow(
      "NOT_FOUND",
    );
    run(ws, { method: "removeGuideline", owner, guidelineId: g.id });
    expect(listGuidelines(ws).map((x) => x.path)).toEqual(["b.md"]);
  });
});

describe("project domains", () => {
  const inP1 = { scope: "project", projectId: "p1" } as const;
  const create = (doc: LoroDoc, name: string) =>
    run<Domain>(doc, { method: "createDomain", domain: { name, color: "#14B8A6" }, owner: inP1 });
  const file = (domainId: string, path: string, content = "") =>
    ({
      method: "addGuideline",
      owner: { scope: "domain", domainId, projectId: "p1" },
      path,
      content,
    }) as const;

  test("createDomain in a project doc stores it in projectDomains with its owner", () => {
    const doc = project();
    const sync = create(doc, "Sync");
    expect(sync).toEqual({ id: sync.id, name: "Sync", color: "#14B8A6", owner: inP1 });
    expect(doc.getMap("projectDomains").toJSON()).toEqual({
      [sync.id]: { name: "Sync", color: "#14B8A6", guidelines: [] },
    });
    expect(listProjectDomains(doc)).toEqual([sync]);
    expect(listDomains(doc)).toEqual([]);
  });

  test("domain guidelines are nested in their project domain", () => {
    const doc = project();
    const sync = create(doc, "Sync");
    const g = run<Guideline>(doc, file(sync.id, "sync.md", "# Sync"));
    expect(g).toEqual({
      id: `${sync.id}:sync.md`,
      owner: { scope: "domain", domainId: sync.id, projectId: "p1" },
      path: "sync.md",
      content: "# Sync",
    });
    expect(() => run(doc, file(sync.id, "sync.md"))).toThrow("INVALID_INPUT");
    const owner = g.owner;
    const moved = run<Guideline>(doc, {
      method: "updateGuideline",
      owner,
      guidelineId: g.id,
      path: "guidelines/sync.md",
      content: "# Sync v2",
    });
    expect(moved).toMatchObject({ id: `${sync.id}:guidelines/sync.md`, content: "# Sync v2" });
    expect(listProjectDomainGuidelines(doc)).toEqual([moved]);
    expect(() => run(doc, { method: "removeGuideline", owner, guidelineId: g.id })).toThrow("NOT_FOUND");
    run(doc, { method: "removeGuideline", owner, guidelineId: moved.id });
    expect(listProjectDomainGuidelines(doc)).toEqual([]);
    expect(() => run(doc, file("nope", "x.md"))).toThrow("NOT_FOUND");
  });

  test("updateDomain and deleteDomain, which drops its guidelines", () => {
    const doc = project();
    const sync = create(doc, "Sync");
    run(doc, file(sync.id, "sync.md"));
    const renamed = run<Domain>(doc, {
      method: "updateDomain",
      domainId: sync.id,
      patch: { name: "Synchro", color: "#6366F1" },
      owner: inP1,
    });
    expect(renamed).toEqual({ ...sync, name: "Synchro", color: "#6366F1" });
    expect(listProjectDomainGuidelines(doc)).toHaveLength(1);
    run(doc, { method: "deleteDomain", domainId: sync.id, owner: inP1 });
    expect(listProjectDomains(doc)).toEqual([]);
    expect(listProjectDomainGuidelines(doc)).toEqual([]);
    expect(() => run(doc, { method: "deleteDomain", domainId: sync.id, owner: inP1 })).toThrow("NOT_FOUND");
    expect(() =>
      run(doc, { method: "updateDomain", domainId: "nope", patch: { name: "X" }, owner: inP1 }),
    ).toThrow("NOT_FOUND");
  });

  test("names are unique per doc, case ignored", () => {
    const a = project("p1");
    create(a, "UI");
    expect(() => create(a, "ui")).toThrow("INVALID_INPUT");
    const b = project("p2");
    run(b, {
      method: "createDomain",
      domain: { name: "UI", color: "#14B8A6" },
      owner: { scope: "project", projectId: "p2" },
    });
    const ws = createWorkspaceDoc();
    run(ws, { method: "createDomain", domain: { name: "UI", color: "#14B8A6" } });
    expect(listDomains(ws).map((d) => d.name)).toEqual(["UI"]);
  });

  test("a command sent to the wrong doc is refused", () => {
    const ws = createWorkspaceDoc();
    const doc = project();
    const domain = { name: "UI", color: "#14B8A6" };
    expect(() => run(ws, { method: "createDomain", domain, owner: inP1 })).toThrow("INVALID_INPUT");
    expect(() => run(doc, { method: "createDomain", domain })).toThrow("INVALID_INPUT");
    expect(() =>
      run(doc, { method: "createDomain", domain, owner: { scope: "project", projectId: "p2" } }),
    ).toThrow("INVALID_INPUT");
    const sync = create(doc, "Sync");
    expect(() => run(ws, file(sync.id, "a.md"))).toThrow("INVALID_INPUT");
    expect(() =>
      run(doc, {
        method: "addGuideline",
        owner: { scope: "domain", domainId: sync.id, projectId: null },
        path: "a.md",
        content: "",
      }),
    ).toThrow("INVALID_INPUT");
    expect(() => run(ws, { method: "deleteDomain", domainId: sync.id, owner: inP1 })).toThrow(
      "INVALID_INPUT",
    );
  });
});

describe("workspace name", () => {
  test("an empty or too long workspace name is refused by the schema", () => {
    expect(ConfigCommand.safeParse({ method: "updateWorkspace", patch: { name: "   " } }).success).toBe(
      false,
    );
    expect(
      ConfigCommand.safeParse({ method: "updateWorkspace", patch: { name: "x".repeat(41) } }).success,
    ).toBe(false);
  });

  test("updateWorkspace sets the name and the description, and null clears the description", () => {
    const ws = createWorkspaceDoc();
    expect(workspaceName(ws)).toBeNull();
    expect(
      executeConfigCommand(
        ws,
        ConfigCommand.parse({
          method: "updateWorkspace",
          patch: { name: " Maison ", description: " Mes projets " },
        }),
      ),
    ).toEqual({ name: "Maison", description: "Mes projets" });
    expect(workspaceDescription(ws)).toBe("Mes projets");
    expect(executeConfigCommand(ws, { method: "updateWorkspace", patch: { description: null } })).toEqual({
      name: "Maison",
      description: null,
    });
    expect(workspaceDescription(ws)).toBeNull();
    expect(() => executeConfigCommand(ws, { method: "updateWorkspace", patch: {} })).toThrow("INVALID_INPUT");
  });
});

describe("legacy profiles", () => {
  const legacy = (ws: LoroDoc) => {
    ws.getMap("profiles").set("p1", { id: "p1", name: "opus-dev" });
    ws.getMap("profiles").set("p2", { id: "p2", name: "haiku-tests" });
    const guidelines = ws.getMap("guidelines");
    guidelines.set("g1", {
      id: "g1",
      owner: { scope: "profile", profileId: "p1" },
      path: "a.md",
      content: "a",
    });
    guidelines.set("g2", {
      id: "g2",
      owner: { scope: "profile", profileId: "p2" },
      path: "b.md",
      content: "b",
    });
    guidelines.set("g3", { id: "g3", owner: { scope: "workspace" }, path: "c.md", content: "c" });
    ws.commit();
  };

  test("their guidelines are ignored when reading", () => {
    const ws = createWorkspaceDoc();
    legacy(ws);
    expect(listGuidelines(ws).map((g) => g.id)).toEqual(["g3"]);
  });

  test("dropProfiles empties the profiles and their guidelines, once", () => {
    const ws = createWorkspaceDoc();
    legacy(ws);
    expect(dropProfiles(ws)).toEqual({ profiles: 2, guidelines: 2 });
    expect(ws.getMap("profiles").size).toBe(0);
    expect(Object.keys(ws.getMap("guidelines").toJSON())).toEqual(["g3"]);
    expect(dropProfiles(ws)).toEqual({ profiles: 0, guidelines: 0 });
  });

  test("a guideline that is neither legacy nor valid still reads as corrupt", () => {
    const ws = createWorkspaceDoc();
    ws.getMap("guidelines").set("bad", {
      id: "bad",
      owner: { scope: "workspace" },
      path: "../x.md",
      content: "",
    });
    ws.commit();
    expect(() => listGuidelines(ws)).toThrow("STORE_CORRUPT");
  });
});
