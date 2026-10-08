import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { ProjectHome } from "./ProjectHome";

const project = (access: ProjectSnapshot["sync"]["access"]): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
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

test("an empty read-only project offers no page creation", () => {
  const { unmount } = render(
    <ProjectHome project={project("write")} onNewPage={() => {}} onSuggest={() => {}} />,
  );
  expect(screen.getByRole("button", { name: "Nouvelle page" })).toBeTruthy();
  unmount();
  render(<ProjectHome project={project("read-only")} onNewPage={() => {}} onSuggest={() => {}} />);
  expect(screen.queryByRole("button", { name: "Nouvelle page" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Proposer/ })).toBeNull();
});
