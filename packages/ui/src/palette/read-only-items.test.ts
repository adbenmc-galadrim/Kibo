import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import { buildItems, type PaletteContext } from "./palette-items";

const meta = {
  id: "p1",
  name: "Kibo",
  key: "KIB",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
};
const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 };
const snapshot = (access: ProjectSnapshot["sync"]["access"]): ProjectSnapshot => ({
  meta,
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: null,
  sync: { shared: true, keyAllocator: "server", role: "viewer", access, members: [] },
});
const context = (access: ProjectSnapshot["sync"]["access"]): PaletteContext => ({
  projects: [{ ...meta, counts } satisfies ProjectSummary],
  snapshots: new Map([["p1", snapshot(access)]]),
  recents: [],
  activeProjectId: "p1",
  activeTicketId: null,
  agents: null,
});
const actions = (access: ProjectSnapshot["sync"]["access"]) =>
  buildItems(context(access))
    .filter((i) => i.group === "actions")
    .map((i) => i.id);

test("the palette offers no creation in a read-only or revoked project", () => {
  expect(actions("write")).toContain("action:newTicket");
  expect(actions("write")).toContain("action:newPage");
  for (const access of ["read-only", "revoked"] as const) {
    expect(actions(access)).not.toContain("action:newTicket");
    expect(actions(access)).not.toContain("action:newPage");
  }
});
