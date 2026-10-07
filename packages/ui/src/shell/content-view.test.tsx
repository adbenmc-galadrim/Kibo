import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { ContentView } from "./ContentView";

const summary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  worktree: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const project: ProjectSnapshot = {
  meta: summary,
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};
const noop = () => {};

test("a reopened tab whose page was deleted shows « Page introuvable »", () => {
  render(
    <ContentView
      target={{ kind: "page", projectId: "p1", pageId: "9@9" }}
      viewer="me"
      projects={[summary]}
      inboxCount={0}
      project={project}
      domains={[]}
      startEditing={false}
      onNewProject={noop}
      onImportProject={noop}
      onTutorial={noop}
      onNewPage={noop}
      onSuggestPages={noop}
      onOpen={noop}
      onOpenFile={noop}
      onAssign={noop}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByText("Page introuvable")).toBeTruthy();
});
