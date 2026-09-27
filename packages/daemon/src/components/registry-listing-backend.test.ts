import { expect, test } from "bun:test";
import { createWorkspaceDoc, putRegistryVersion } from "@kibo/core";
import { ComponentManifest, NO_PERMISSIONS } from "@kibo/schema";
import { listComponents } from "./registry-listing";
import type { StoredVersion } from "./store";

const put = (ws: ReturnType<typeof createWorkspaceDoc>, version: string) =>
  putRegistryVersion(ws, "burndown", "Burndown", {
    version,
    hash: "a".repeat(64),
    origin: "marketplace",
    trust: "sandboxed",
    approvedHash: "a".repeat(64),
    granted: NO_PERMISSIONS,
    publishedAt: 0,
    autoUpdate: false,
    source: null,
    revoked: null,
  });

const stored = (version: string, withServer: boolean): StoredVersion => ({
  id: "burndown",
  version,
  hash: "a".repeat(64),
  manifest: ComponentManifest.parse({
    id: "burndown",
    version,
    kind: "widget",
    title: "Burndown",
    reads: [],
    writes: [],
  }),
  build: withServer ? { "server.js": new TextEncoder().encode("export {}") } : {},
});

test("a version has a backend when its store holds a server bundle", () => {
  const ws = createWorkspaceDoc();
  put(ws, "0.1.0");
  put(ws, "0.2.0");
  const all = listComponents(ws, {
    projects: [],
    store: { get: (_id, version) => stored(version, version === "0.2.0") },
    isTampered: () => false,
  });
  const versions = all.find((c) => c.id === "burndown")?.versions ?? [];
  expect(versions.map((v) => [v.version, v.backend])).toEqual([
    ["0.1.0", false],
    ["0.2.0", true],
  ]);
  expect(all.filter((c) => c.builtin).every((c) => c.versions.every((v) => !v.backend))).toBe(true);
});
