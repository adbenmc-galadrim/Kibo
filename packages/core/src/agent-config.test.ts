import { describe, expect, test } from "bun:test";
import type { AgentProfile, ConfigCommand, Domain, Guideline, ProfileInput } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import {
  configTarget,
  executeConfigCommand,
  getProfile,
  listDomains,
  listGuidelines,
  listProfiles,
} from "./agent-config";
import { createProjectDoc } from "./project";
import { createWorkspaceDoc } from "./workspace";

const opus: ProfileInput = {
  name: "opus-dev",
  model: "opus",
  execution: "cli",
  permissionMode: "acceptEdits",
  workspace: "worktree",
  maxParallel: 2,
  subagents: ["sonnet", "haiku"],
};
const run = <T>(doc: LoroDoc, cmd: ConfigCommand) => executeConfigCommand(doc, cmd) as T;
const project = () =>
  createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });

describe("profiles", () => {
  test("are created, listed, updated and deleted", () => {
    const ws = createWorkspaceDoc();
    const p = run<AgentProfile>(ws, { method: "createProfile", profile: opus });
    expect(p.id).toBeString();
    expect(p).toEqual({ ...opus, id: p.id });
    expect(listProfiles(ws)).toEqual([p]);
    const updated = run<AgentProfile>(ws, {
      method: "updateProfile",
      profileId: p.id,
      patch: { maxParallel: 3 },
    });
    expect(getProfile(ws, p.id)).toEqual({ ...p, maxParallel: 3 });
    expect(updated.maxParallel).toBe(3);
    run(ws, { method: "deleteProfile", profileId: p.id });
    expect(listProfiles(ws)).toEqual([]);
    expect(() => getProfile(ws, p.id)).toThrow("NOT_FOUND");
  });

  test("names are unique and values are validated", () => {
    const ws = createWorkspaceDoc();
    const p = run<AgentProfile>(ws, { method: "createProfile", profile: opus });
    expect(() => run(ws, { method: "createProfile", profile: opus })).toThrow("INVALID_INPUT");
    expect(() => run(ws, { method: "updateProfile", profileId: p.id, patch: { maxParallel: 0 } })).toThrow(
      "INVALID_INPUT",
    );
    expect(() => run(ws, { method: "updateProfile", profileId: "nope", patch: {} })).toThrow("NOT_FOUND");
  });

  test("live in the workspace doc only", () => {
    expect(() => run(project(), { method: "createProfile", profile: opus })).toThrow("INVALID_INPUT");
  });
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
  test("workspace, domain and profile guidelines live in the workspace doc", () => {
    const ws = createWorkspaceDoc();
    const p = run<AgentProfile>(ws, { method: "createProfile", profile: opus });
    const d = run<Domain>(ws, { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } });
    run(ws, { method: "addGuideline", owner: { scope: "workspace" }, path: "general.md", content: "a" });
    run(ws, {
      method: "addGuideline",
      owner: { scope: "domain", domainId: d.id },
      path: "core.md",
      content: "b",
    });
    run(ws, {
      method: "addGuideline",
      owner: { scope: "profile", profileId: p.id },
      path: "front.md",
      content: "c",
    });
    expect(
      listGuidelines(ws)
        .map((g) => g.owner.scope)
        .sort(),
    ).toEqual(["domain", "profile", "workspace"]);
    expect(() =>
      run(ws, {
        method: "addGuideline",
        owner: { scope: "domain", domainId: "nope" },
        path: "x.md",
        content: "",
      }),
    ).toThrow("NOT_FOUND");
    run(ws, { method: "deleteProfile", profileId: p.id });
    expect(listGuidelines(ws).some((g) => g.owner.scope === "profile")).toBe(false);
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
