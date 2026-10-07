import { describe, expect, test } from "bun:test";
import {
  type AgentProfile,
  ConfigCommand,
  type Domain,
  type Guideline,
  type ProfileInput,
} from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import {
  configTarget,
  ensureSystemProfiles,
  executeConfigCommand,
  getProfile,
  listDomains,
  listGuidelines,
  listProfiles,
  workspaceDescription,
  workspaceName,
} from "./agent-config";
import { updateProfile } from "./agent-profiles";
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
  enabled: true,
  allow: [],
};
const run = <T>(doc: LoroDoc, cmd: ConfigCommand) => executeConfigCommand(doc, cmd) as T;
const project = () =>
  createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316", worktree: null });

describe("profiles", () => {
  test("are created, listed, updated and deleted", () => {
    const ws = createWorkspaceDoc();
    const p = run<AgentProfile>(ws, { method: "createProfile", profile: opus });
    expect(p.id).toBeString();
    expect(p).toEqual({ ...opus, id: p.id, system: false });
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

  test("a patch that leaves the rules out keeps them, an explicit list replaces them", () => {
    const ws = createWorkspaceDoc();
    const rules = ["Bash(pnpm *)", "Edit"];
    const p = run<AgentProfile>(ws, { method: "createProfile", profile: { ...opus, allow: rules } });
    const { allow: _omitted, ...withoutRules } = opus;
    const parsed = ConfigCommand.parse({
      method: "updateProfile",
      profileId: p.id,
      patch: { ...withoutRules, maxParallel: 3 },
    });
    expect(run<AgentProfile>(ws, parsed).allow).toEqual(rules);
    expect(updateProfile(ws, p.id, { maxParallel: 4, allow: undefined }).allow).toEqual(rules);
    expect(getProfile(ws, p.id)).toMatchObject({ maxParallel: 4, allow: rules });
    expect(() => updateProfile(ws, p.id, { allow: ["Bash(*)"] })).toThrow("INVALID_INPUT");
    expect(
      run<AgentProfile>(ws, { method: "updateProfile", profileId: p.id, patch: { allow: [] } }).allow,
    ).toEqual([]);
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

describe("system profiles", () => {
  test("ensureSystemProfiles creates the system profiles once, with the first user model", () => {
    const ws = createWorkspaceDoc();
    run(ws, { method: "createProfile", profile: { ...opus, name: "zed", model: "haiku" } });
    run(ws, { method: "createProfile", profile: { ...opus, name: "alpha", model: "opus" } });
    expect(ensureSystemProfiles(ws)).toBe(true);
    expect(ensureSystemProfiles(ws)).toBe(false);
    const system = listProfiles(ws).filter((p) => p.system);
    expect(
      system.map((p) => [p.id, p.permissionMode, p.model, p.enabled, p.maxParallel, p.workspace]),
    ).toEqual([
      ["assistant", "default", "opus", true, 1, "isolated"],
      ["demo", "acceptEdits", "opus", true, 1, "isolated"],
      ["generateur", "acceptEdits", "opus", true, 2, "isolated"],
    ]);
  });

  test("without user profiles the model is sonnet; model and enabled survive a restart", () => {
    const ws = createWorkspaceDoc();
    ensureSystemProfiles(ws);
    expect(getProfile(ws, "assistant").model).toBe("sonnet");
    run(ws, { method: "updateProfile", profileId: "generateur", patch: { model: "opus", enabled: false } });
    expect(ensureSystemProfiles(ws)).toBe(false);
    expect(getProfile(ws, "generateur")).toMatchObject({
      model: "opus",
      enabled: false,
      permissionMode: "acceptEdits",
    });
  });

  test("a tampered system profile is restored to its fixed values", () => {
    const ws = createWorkspaceDoc();
    ensureSystemProfiles(ws);
    ws.getMap("profiles").set("assistant", {
      ...getProfile(ws, "assistant"),
      maxParallel: 9,
      model: "haiku",
    });
    ws.commit();
    expect(ensureSystemProfiles(ws)).toBe(true);
    expect(getProfile(ws, "assistant")).toMatchObject({ maxParallel: 1, model: "haiku", system: true });
  });

  test("a system profile only changes its model and enabled flag, and cannot be deleted", () => {
    const ws = createWorkspaceDoc();
    ensureSystemProfiles(ws);
    expect(() =>
      run(ws, { method: "updateProfile", profileId: "assistant", patch: { permissionMode: "acceptEdits" } }),
    ).toThrow("INVALID_INPUT");
    expect(() => run(ws, { method: "updateProfile", profileId: "assistant", patch: { name: "x" } })).toThrow(
      "INVALID_INPUT",
    );
    expect(() => run(ws, { method: "deleteProfile", profileId: "generateur" })).toThrow("INVALID_INPUT");
    expect(getProfile(ws, "generateur").system).toBe(true);
  });

  test("a user profile cannot take a system profile name", () => {
    const ws = createWorkspaceDoc();
    ensureSystemProfiles(ws);
    expect(() => run(ws, { method: "createProfile", profile: { ...opus, name: "assistant" } })).toThrow(
      "INVALID_INPUT",
    );
  });

  test("a user profile already named like a system profile keeps working", () => {
    const ws = createWorkspaceDoc();
    ws.getMap("profiles").set("legacy", { ...opus, name: "assistant", id: "legacy" });
    ws.commit();
    const old = getProfile(ws, "legacy");
    ensureSystemProfiles(ws);
    run(ws, { method: "updateProfile", profileId: old.id, patch: { maxParallel: 3 } });
    run(ws, { method: "updateProfile", profileId: "assistant", patch: { model: "haiku" } });
    expect(getProfile(ws, old.id).maxParallel).toBe(3);
    expect(getProfile(ws, "assistant").model).toBe("haiku");
  });

  test("the system flag comes from the id, not from the stored value", () => {
    const ws = createWorkspaceDoc();
    ensureSystemProfiles(ws);
    const { system: _system, ...rewritten } = getProfile(ws, "assistant");
    ws.getMap("profiles").set("assistant", rewritten);
    ws.getMap("profiles").set("u1", { ...opus, name: "forged", id: "u1", system: true });
    ws.commit();
    expect(getProfile(ws, "assistant").system).toBe(true);
    expect(getProfile(ws, "u1").system).toBe(false);
    expect(
      listProfiles(ws)
        .filter((p) => p.system)
        .map((p) => p.id),
    ).toEqual(["assistant", "demo", "generateur"]);
    expect(() => run(ws, { method: "deleteProfile", profileId: "assistant" })).toThrow("INVALID_INPUT");
  });

  test("a create or a patch cannot set the system flag", () => {
    const ws = createWorkspaceDoc();
    const user = run<AgentProfile>(ws, { method: "createProfile", profile: opus });
    const patch = { maxParallel: 3, system: true };
    expect(() => run(ws, { method: "updateProfile", profileId: user.id, patch })).toThrow("INVALID_INPUT");
    expect(getProfile(ws, user.id)).toMatchObject({ system: false, maxParallel: 2 });
    const profile = { ...opus, name: "sneaky", system: true };
    expect(() => run(ws, { method: "createProfile", profile })).toThrow("INVALID_INPUT");
    expect(listProfiles(ws).map((p) => p.name)).toEqual(["opus-dev"]);
  });

  test("a system profile name is reserved even before the system profiles exist", () => {
    const ws = createWorkspaceDoc();
    expect(() => run(ws, { method: "createProfile", profile: { ...opus, name: "generateur" } })).toThrow(
      "INVALID_INPUT",
    );
    const user = run<AgentProfile>(ws, { method: "createProfile", profile: opus });
    expect(() =>
      run(ws, { method: "updateProfile", profileId: user.id, patch: { name: "assistant" } }),
    ).toThrow("INVALID_INPUT");
    expect(listProfiles(ws).map((p) => p.name)).toEqual(["opus-dev"]);
  });

  test("a legacy user profile named like a system profile can be renamed away", () => {
    const ws = createWorkspaceDoc();
    ws.getMap("profiles").set("old", { ...opus, name: "assistant", id: "old" });
    ws.commit();
    ensureSystemProfiles(ws);
    run(ws, { method: "updateProfile", profileId: "old", patch: { name: "assistant", maxParallel: 3 } });
    run(ws, { method: "updateProfile", profileId: "old", patch: { name: "legacy" } });
    expect(getProfile(ws, "old")).toMatchObject({ name: "legacy", maxParallel: 3, system: false });
  });

  test("a stored profile written before phase 6 reads as a user profile, enabled", () => {
    const ws = createWorkspaceDoc();
    const { enabled: _enabled, ...legacy } = opus;
    ws.getMap("profiles").set("old", { ...legacy, id: "old" });
    ws.commit();
    expect(getProfile(ws, "old")).toMatchObject({ system: false, enabled: true });
  });
});
