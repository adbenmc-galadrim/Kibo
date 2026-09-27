import { expect, test } from "bun:test";
import { createWorkspaceDoc, putRegistryVersion } from "@kibo/core";
import { NO_PERMISSIONS } from "@kibo/schema";
import { listComponents } from "./registry-listing";

test("a revoked version carries its reason, builtins stay null", () => {
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "burndown", "Burndown", {
    version: "0.1.0",
    hash: "a".repeat(64),
    origin: "marketplace",
    trust: null,
    approvedHash: null,
    granted: NO_PERMISSIONS,
    publishedAt: 0,
    autoUpdate: false,
    source: { sourceId: "equipe", publisherKey: "K" },
    revoked: { reason: "Faille", at: 5 },
  });
  const all = listComponents(ws, { projects: [], store: { get: () => undefined }, isTampered: () => false });
  expect(all.find((c) => c.id === "burndown")?.versions[0]?.revoked).toEqual({ reason: "Faille", at: 5 });
  expect(all.filter((c) => c.builtin).every((c) => c.versions.every((v) => v.revoked === null))).toBe(true);
});
