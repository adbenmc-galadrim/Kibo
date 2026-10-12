import { describe, expect, test } from "bun:test";
import { ConfigCommand, type Domain, type Guideline } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import {
  configTarget,
  dropProfiles,
  executeConfigCommand,
  listDomains,
  listGuidelines,
  workspaceDescription,
  workspaceName,
} from "./agent-config";
import { createProjectDoc } from "./project";
import { createWorkspaceDoc } from "./workspace";

const run = <T>(doc: LoroDoc, cmd: ConfigCommand) => executeConfigCommand(doc, cmd) as T;
const project = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
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
      owner: { scope: "domain", domainId: core.id },
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
      owner: { scope: "domain", domainId: d.id },
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
        owner: { scope: "domain", domainId: "nope" },
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
    const wrong = { scope: "domain", domainId: "x" } as const;
    expect(() => run(ws, { method: "removeGuideline", owner: wrong, guidelineId: g.id })).toThrow(
      "NOT_FOUND",
    );
    run(ws, { method: "removeGuideline", owner, guidelineId: g.id });
    expect(listGuidelines(ws).map((x) => x.path)).toEqual(["b.md"]);
  });

  test("configTarget routes project guidelines to their project", () => {
    const owner = { scope: "project", projectId: "p1" } as const;
    expect(configTarget({ method: "addGuideline", owner, path: "a.md", content: "" })).toBe("p1");
    expect(
      configTarget({ method: "removeGuideline", owner: { scope: "workspace" }, guidelineId: "g" }),
    ).toBeNull();
    expect(configTarget({ method: "deleteDomain", domainId: "d" })).toBeNull();
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
    expect(configTarget({ method: "updateWorkspace", patch: { name: "x" } })).toBeNull();
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
