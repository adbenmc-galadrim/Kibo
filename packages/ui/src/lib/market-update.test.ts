import { expect, test } from "bun:test";
import { type ComponentVersionSummary, NO_PERMISSIONS } from "@kibo/schema";
import { buildUpdateSummary } from "./market-update";

const usage = (n: number) => ({
  projectId: `p${n}`,
  projectName: n === 1 ? "Kibo" : "Portfolio",
  pageId: `pg${n}`,
  pageTitle: "Tableau de bord",
  instanceId: `i${n}`,
});
const current: ComponentVersionSummary = {
  version: "0.1.0",
  hash: "a".repeat(64),
  trust: "sandboxed",
  origin: "marketplace",
  active: true,
  tampered: false,
  manifest: {
    id: "burndown",
    version: "0.1.0",
    kind: "widget",
    title: "Burndown",
    description: "",
    reads: ["ticket"],
    writes: [],
    data: false,
    net: [],
    secrets: [],
    mcp: [],
    configVersion: 0,
    changes: [],
    sdk: 1,
  },
  usages: [usage(1), usage(2)],
  revoked: null,
};
const detail = {
  version: "0.2.0",
  permissions: { ...NO_PERMISSIONS, reads: ["ticket" as const, "status" as const], data: true },
  files: [
    { path: "kibo.component.json", content: JSON.stringify({ changes: ["Ligne idéale", "Export CSV"] }) },
  ],
};

test("the update summary lists usages, the publisher changes and the new permissions", () => {
  const s = buildUpdateSummary({ summary: current, detail });
  expect(s).toMatchObject({
    from: "0.1.0",
    to: "0.2.0",
    migration: null,
    changes: ["Ligne idéale", "Export CSV"],
  });
  expect(s.usages.map((u) => [u.projectName, u.version])).toEqual([
    ["Kibo", "0.1.0"],
    ["Portfolio", "0.1.0"],
  ]);
  expect(s.newPermissions.length).toBe(2);
});

test("a manifest without changes gives an empty list", () => {
  expect(buildUpdateSummary({ summary: current, detail: { ...detail, files: [] } }).changes).toEqual([]);
});

test("an unreadable manifest gives an empty list", () => {
  const broken = { ...detail, files: [{ path: "kibo.component.json", content: "{" }] };
  expect(buildUpdateSummary({ summary: current, detail: broken }).changes).toEqual([]);
});
