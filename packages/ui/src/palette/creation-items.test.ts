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
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
};
const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 };
const snapshot = (): ProjectSnapshot => ({
  meta,
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sprints: [],
});
const context = (): PaletteContext => ({
  projects: [{ ...meta, counts } satisfies ProjectSummary],
  snapshots: new Map([["p1", snapshot()]]),
  recents: [],
  activeProjectId: "p1",
  activeTicketId: null,
});
const actions = () =>
  buildItems(context())
    .filter((i) => i.group === "actions")
    .map((i) => i.id);

test("the palette offers to create a ticket and a page in the active project", () => {
  expect(actions()).toContain("action:newTicket");
  expect(actions()).toContain("action:newPage");
});
