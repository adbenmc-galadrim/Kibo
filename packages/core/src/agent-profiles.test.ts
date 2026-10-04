import { expect, test } from "bun:test";
import {
  ensureSystemProfiles,
  getProfile,
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
  expect(SYSTEM_DEFAULT_PARALLEL).toEqual({ assistant: 1, generateur: 2, demo: 1 });
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
