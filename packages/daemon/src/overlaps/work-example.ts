import type { ParallelRun, ParallelWork, ProjectSnapshot } from "@kibo/schema";

export const EXAMPLE_NOW = 0;
const MINUTE = 60_000;

function exampleRun(key: string, n: number, over: Partial<ParallelRun>): ParallelRun {
  return {
    runId: `example-${n}`,
    name: `${key.toLowerCase()} · livraison · ${key}-${n}`,
    ticketKey: `${key}-${n}`,
    ticketTitle: n === 1 ? "Format des dates" : "Page de suivi",
    startedAt: EXAMPLE_NOW - 20 * MINUTE,
    step: null,
    plan: null,
    files: [],
    exports: [],
    workspace: "worktree",
    worktreeName: `${key.toLowerCase()}-${n}`,
    truncated: false,
    ...over,
  };
}

export function exampleParallelWork(project: ProjectSnapshot): ParallelWork {
  const key = project.meta.key;
  const first = exampleRun(key, 1, {
    step: "Écrire les tests",
    plan: [
      { id: "a", title: "Lire le code existant", status: "done", note: null },
      { id: "b", title: "Écrire les tests", status: "doing", note: null },
    ],
    files: [
      { path: "src/lib/format.ts", status: "added", added: 42, removed: 0 },
      { path: "src/i18n/fr.ts", status: "modified", added: 3, removed: 1 },
    ],
    exports: [
      { name: "formatDate", path: "src/lib/format.ts" },
      { name: "formatTime", path: "src/lib/format.ts" },
    ],
  });
  const second = exampleRun(key, 2, {
    startedAt: EXAMPLE_NOW - 8 * MINUTE,
    files: [{ path: "src/pages/track.ts", status: "added", added: 18, removed: 0 }],
  });
  return {
    runs: [first, second],
    more: 0,
    overlaps: [
      {
        id: "example-overlap",
        projectId: project.meta.id,
        kind: "export",
        key: "export:formatDate",
        ownerRunId: first.runId,
        otherRunId: "example",
        ownerWorkspace: `.kibo/worktrees/${first.worktreeName}`,
        otherWorkspace: ".kibo/worktrees/example",
        detail: {
          kind: "export",
          name: "formatDate",
          ownerPath: "src/lib/format.ts",
          otherPath: "src/utils/date.ts",
        },
        firstSeenAt: EXAMPLE_NOW,
        lastSeenAt: EXAMPLE_NOW,
        status: "open",
        deliveredAt: null,
        ownerDeliveredAt: null,
        resolvedAt: null,
        ignoredBy: null,
        ignoredAt: null,
      },
    ],
    partial: false,
    sharedPaths: ["src/i18n/fr.ts"],
  };
}
