import { expect, test } from "bun:test";
import type { ComponentSummary } from "@kibo/schema";
import { componentRows } from "./rows";

const usage = (projectId: string, pageId: string) => ({
  projectId,
  projectName: projectId,
  pageId,
  pageTitle: pageId,
  instanceId: `${projectId}-${pageId}`,
});

test("built-ins come from the UI registry, installed versions one row each, sorted by title", () => {
  const summaries: ComponentSummary[] = [
    {
      id: "kanban",
      title: "kanban",
      builtin: true,
      versions: [
        {
          version: "1.0.0",
          hash: null,
          trust: "builtin",
          origin: "kibo",
          active: true,
          tampered: false,
          manifest: null,
          usages: [usage("p1", "a"), usage("p1", "b"), usage("p2", "c")],
          revoked: null,
          backend: false,
        },
      ],
    },
    {
      id: "pr-queue",
      title: "PR en attente",
      builtin: false,
      versions: [
        {
          version: "0.3.0",
          hash: "a".repeat(64),
          trust: "sandboxed",
          origin: "ai",
          active: true,
          tampered: false,
          manifest: null,
          usages: [usage("p1", "a")],
          revoked: null,
          backend: false,
        },
        {
          version: "0.4.0",
          hash: "b".repeat(64),
          trust: null,
          origin: "ai",
          active: false,
          tampered: false,
          manifest: null,
          usages: [],
          revoked: null,
          backend: false,
        },
      ],
    },
  ];
  expect(
    componentRows(summaries).map((r) => [r.title, r.version, r.trust, r.pages, r.projects, r.used]),
  ).toEqual([
    ["Graphe de dépendances", "1.0.0", "builtin", 0, 0, false],
    ["Kanban", "1.0.0", "builtin", 3, 2, true],
    ["Notes", "1.0.0", "builtin", 0, 0, false],
    ["PR en attente", "0.4.0", "pending", 0, 0, false],
    ["PR en attente", "0.3.0", "sandboxed", 1, 1, true],
    ["Serpent", "1.0.0", "builtin", 0, 0, false],
    ["Source MCP", "1.0.0", "builtin", 0, 0, false],
    ["Tickets", "1.0.0", "builtin", 0, 0, false],
    ["Visionneuse 3D", "1.0.0", "builtin", 0, 0, false],
  ]);
});

test("a marketplace version gets its status by id and version, and carries its revocation", () => {
  const version = (v: string, revoked: { reason: string; at: number } | null) => ({
    version: v,
    hash: "c".repeat(64),
    trust: null,
    origin: "marketplace" as const,
    active: false,
    tampered: false,
    manifest: null,
    usages: [],
    revoked,
    backend: false,
  });
  const summaries: ComponentSummary[] = [
    {
      id: "burndown",
      title: "Burndown",
      builtin: false,
      versions: [version("0.1.0", null), version("0.2.0", { reason: "Faille", at: 3 })],
    },
  ];
  const status = {
    id: "burndown",
    version: "0.1.0",
    sourceId: "equipe",
    sourceName: "Équipe",
    updateAvailable: "0.3.0",
  };
  const rows = componentRows(summaries, [status]).filter((r) => r.id === "burndown");
  expect(rows.map((r) => [r.version, r.market, r.revoked])).toEqual([
    ["0.2.0", null, { reason: "Faille", at: 3 }],
    ["0.1.0", status, null],
  ]);
});
