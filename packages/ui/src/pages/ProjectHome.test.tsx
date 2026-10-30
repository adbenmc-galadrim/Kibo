import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { ProjectHome } from "./ProjectHome";

const project = (): ProjectSnapshot => ({
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
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

test("an empty project offers to create a page", () => {
  render(<ProjectHome project={project()} onNewPage={() => {}} />);
  expect(screen.getByRole("button", { name: "Nouvelle page" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Proposer/ })).toBeNull();
});
