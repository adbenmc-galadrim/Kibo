import { expect, test } from "bun:test";
import {
  assertDeletableProfile,
  ensureSystemProfiles,
  getProfile,
  listProfiles,
  SYSTEM_DEFAULT_PARALLEL,
  SYSTEM_MAX_PARALLEL,
  updateProfile,
} from "./agent-profiles";
import { createWorkspaceDoc } from "./workspace";

test("a new workspace runs two generators and one assistant at a time", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  expect(getProfile(ws, "generateur").maxParallel).toBe(2);
  expect(getProfile(ws, "assistant").maxParallel).toBe(1);
  expect(SYSTEM_DEFAULT_PARALLEL).toEqual({ assistant: 1, generateur: 2, demo: 1, "project-agent": 1 });
  expect(SYSTEM_MAX_PARALLEL).toBe(4);
});

test("a stored parallelism within bounds is kept", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  ws.getMap("profiles").set("generateur", { ...getProfile(ws, "generateur"), maxParallel: 1 });
  ws.commit();
  expect(ensureSystemProfiles(ws)).toBe(false);
  expect(getProfile(ws, "generateur").maxParallel).toBe(1);
});

test("a stored parallelism above the system bound falls back to the default", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  ws.getMap("profiles").set("generateur", { ...getProfile(ws, "generateur"), maxParallel: 9 });
  ws.commit();
  expect(ensureSystemProfiles(ws)).toBe(true);
  expect(getProfile(ws, "generateur").maxParallel).toBe(2);
});

test("the parallelism of a system profile is editable from 1 to 4, nothing else changes", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  expect(updateProfile(ws, "generateur", { maxParallel: 3 }).maxParallel).toBe(3);
  expect(updateProfile(ws, "assistant", { maxParallel: 4 }).maxParallel).toBe(4);
  expect(ensureSystemProfiles(ws)).toBe(false);
  expect(getProfile(ws, "generateur").maxParallel).toBe(3);
  expect(() => updateProfile(ws, "generateur", { maxParallel: 5 })).toThrow("INVALID_INPUT");
  expect(() => updateProfile(ws, "generateur", { maxParallel: 0 })).toThrow("INVALID_INPUT");
  expect(() => updateProfile(ws, "generateur", { workspace: "repo" })).toThrow("INVALID_INPUT");
  expect(getProfile(ws, "generateur")).toMatchObject({ maxParallel: 3, workspace: "isolated" });
});

test("ensureSystemProfiles creates the three system profiles", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  expect(getProfile(ws, "demo")).toMatchObject({
    name: "demo",
    permissionMode: "acceptEdits",
    system: true,
    workspace: "isolated",
  });
  expect(getProfile(ws, "assistant").system).toBe(true);
  expect(getProfile(ws, "generateur").system).toBe(true);
});

test("the demo profile keeps maxParallel 1", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  ws.getMap("profiles").set("demo", { ...getProfile(ws, "demo"), maxParallel: 3 });
  ws.commit();
  expect(ensureSystemProfiles(ws)).toBe(true);
  expect(getProfile(ws, "demo").maxParallel).toBe(1);
});

test("the demo profile parallelism stays at 1, its model and enabled flag can change", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  expect(() => updateProfile(ws, "demo", { maxParallel: 2 })).toThrow("INVALID_INPUT");
  expect(updateProfile(ws, "demo", { maxParallel: 1 }).maxParallel).toBe(1);
  expect(updateProfile(ws, "demo", { enabled: false }).enabled).toBe(false);
  expect(updateProfile(ws, "demo", { model: "haiku" }).model).toBe("haiku");
});

test("the project agent profile is a system profile limited to its model, switch and parallelism", () => {
  const ws = createWorkspaceDoc();
  ensureSystemProfiles(ws);
  expect(getProfile(ws, "project-agent")).toMatchObject({
    name: "project-agent",
    system: true,
    permissionMode: "default",
    maxParallel: 1,
    workspace: "isolated",
    subagents: [],
  });
  expect(listProfiles(ws).find((p) => p.id === "project-agent")?.system).toBe(true);
  expect(updateProfile(ws, "project-agent", { model: "opus" }).model).toBe("opus");
  expect(updateProfile(ws, "project-agent", { enabled: false }).enabled).toBe(false);
  expect(updateProfile(ws, "project-agent", { maxParallel: 4 }).maxParallel).toBe(4);
  expect(() => updateProfile(ws, "project-agent", { maxParallel: 5 })).toThrow("INVALID_INPUT");
  expect(() => updateProfile(ws, "project-agent", { allow: ["Read"] })).toThrow("INVALID_INPUT");
  expect(() => updateProfile(ws, "project-agent", { name: "chef" })).toThrow("INVALID_INPUT");
  expect(() => updateProfile(ws, "project-agent", { permissionMode: "acceptEdits" })).toThrow(
    "INVALID_INPUT",
  );
  expect(() => assertDeletableProfile(ws, "project-agent")).toThrow("INVALID_INPUT");
});
