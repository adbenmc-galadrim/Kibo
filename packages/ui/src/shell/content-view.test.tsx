import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot } from "@kibo/schema";
import { render as renderPlain, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { agentsFixture } from "../agents/fixtures";
import { AgentsProvider } from "../state/agents-context";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";
import { ContentView } from "./ContentView";
import { type Host, HostProvider } from "./Host";

const shownExecution = fixedStore({ agentExecution: "shown" });
const ShownExecution = ({ children }: { children: ReactNode }) => (
  <AppSettingsProvider store={shownExecution}>{children}</AppSettingsProvider>
);
const render = (ui: ReactElement) => renderPlain(ui, { wrapper: ShownExecution });

const summary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const project: ProjectSnapshot = {
  meta: summary,
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

test("a run target shows the run's own page, even without an open project", async () => {
  const host: Host = {
    openTicket: noop,
    openNewTicket: noop,
    openAssign: noop,
    openFile: noop,
    openView: noop,
    openTarget: noop,
  };
  render(
    <HostProvider host={host}>
      <AgentsProvider agents={agentsFixture()}>
        <ContentView
          target={{ kind: "run", runId: "gone" }}
          viewer="me"
          projects={[summary]}
          inboxCount={0}
          project={null}
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
        />
      </AgentsProvider>
    </HostProvider>,
  );
  expect(await screen.findByText("Run introuvable")).toBeTruthy();
});
