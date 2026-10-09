import { expect, test } from "bun:test";
import {
  addInstance,
  addPage,
  createProjectDoc,
  createTicket,
  createWorkspaceDoc,
  registerProject,
} from "@kibo/core";
import { ensureSystemProfiles } from "@kibo/core/agent-profiles";
import type { LoroDoc } from "loro-crdt";
import { diagnosticCounts } from "./counts";

test("the counts add tickets and instances across projects", () => {
  const workspace = createWorkspaceDoc();
  ensureSystemProfiles(workspace);
  const docs = new Map<string, LoroDoc>();
  for (const [id, key] of [
    ["p1", "KIB"],
    ["p2", "OPS"],
  ] as const) {
    const meta = { id, key, name: key, folder: null, color: "#F97316", worktree: null, storybook: null };
    registerProject(workspace, meta);
    docs.set(id, createProjectDoc(meta));
  }
  const p1 = docs.get("p1");
  const p2 = docs.get("p2");
  if (!p1 || !p2) throw new Error("projects missing");
  createTicket(p1, { title: "Un" });
  createTicket(p1, { title: "Deux" });
  createTicket(p2, { title: "Trois" });
  const page = addPage(p2, { title: "Tableau", kind: "dashboard" });
  addInstance(p2, { pageId: page.id, component: "kanban@1.0.0" });
  const counts = diagnosticCounts({
    workspace,
    project: (id) => {
      const doc = docs.get(id);
      if (!doc) throw new Error(`unknown ${id}`);
      return doc;
    },
    components: () => 5,
  });
  expect(counts).toEqual({ projects: 2, tickets: 3, components: 5, instances: 1, profiles: 4 });
});
