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
    ["Source MCP", "1.0.0", "builtin", 0, 0, false],
    ["Tickets", "1.0.0", "builtin", 0, 0, false],
  ]);
});
