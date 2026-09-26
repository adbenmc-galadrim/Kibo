import { expect, test } from "bun:test";
import type { RegistryVersion } from "@kibo/schema";
import {
  getRegistryVersion,
  highestVersion,
  putRegistryVersion,
  readRegistry,
  removeRegistryVersion,
  updateRegistryVersion,
} from "./registry";
import { createWorkspaceDoc } from "./workspace";

const version = (v: string, hash = "a".repeat(64)): RegistryVersion => ({
  version: v,
  hash,
  origin: "user",
  trust: null,
  approvedHash: null,
  granted: { reads: ["ticket"], writes: [], data: false, net: [], secrets: [], mcp: [] },
  publishedAt: 1,
  autoUpdate: false,
  source: null,
  revoked: null,
});

test("versions are stored per component and survive a snapshot", () => {
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "hello", "Hello", version("0.1.0"));
  putRegistryVersion(ws, "hello", "Hello", version("0.10.0", "b".repeat(64)));
  const copy = createWorkspaceDoc();
  copy.import(ws.export({ mode: "snapshot" }));
  const entry = readRegistry(copy).hello;
  expect(entry?.title).toBe("Hello");
  expect(Object.keys(entry?.versions ?? {}).sort()).toEqual(["0.1.0", "0.10.0"]);
  expect(entry && highestVersion(entry)).toBe("0.10.0");
});

test("trust is updated in place and unknown versions are refused", () => {
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "hello", "Hello", version("0.1.0"));
  const next = updateRegistryVersion(ws, "hello", "0.1.0", {
    trust: "sandboxed",
    approvedHash: "a".repeat(64),
  });
  expect(next.trust).toBe("sandboxed");
  expect(getRegistryVersion(ws, "hello", "0.1.0")?.approvedHash).toBe("a".repeat(64));
  expect(getRegistryVersion(ws, "hello", "9.9.9")).toBeNull();
  expect(() => updateRegistryVersion(ws, "hello", "9.9.9", { trust: null })).toThrow("NOT_FOUND");
  expect(() => removeRegistryVersion(ws, "hello", "9.9.9")).toThrow("NOT_FOUND");
  removeRegistryVersion(ws, "hello", "0.1.0");
  expect(readRegistry(ws).hello).toBeUndefined();
});

test("a corrupt registry entry is reported", () => {
  const ws = createWorkspaceDoc();
  ws.getMap("componentRegistry").set("bad", { title: "" });
  expect(() => readRegistry(ws)).toThrow("STORE_CORRUPT");
});

test("a revocation is written through updateRegistryVersion", () => {
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "burndown", "Burndown", {
    ...version("0.3.0", "c".repeat(64)),
    origin: "marketplace",
    trust: "sandboxed",
    approvedHash: "c".repeat(64),
    source: { sourceId: "team", publisherKey: "AAAA" },
  });
  const next = updateRegistryVersion(ws, "burndown", "0.3.0", {
    trust: null,
    approvedHash: null,
    revoked: { reason: "fuite de données", at: 5 },
  });
  expect(next.revoked).toEqual({ reason: "fuite de données", at: 5 });
  expect(getRegistryVersion(ws, "burndown", "0.3.0")?.revoked?.reason).toBe("fuite de données");
});
