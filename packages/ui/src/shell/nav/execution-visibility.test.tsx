import { expect, mock, test } from "bun:test";
import type { AgentExecution, Screen, TabTarget } from "@kibo/schema";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, kiboProject, NOW, projectsFixture } from "../../agents/fixtures";
import { apiMock } from "../../api-mock";

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async () => null,
      subscribe: () => () => {},
      subscribeAi: () => () => {},
      subscribeEvents: () => () => {},
      subscribeTopic: () => () => {},
    },
  }),
);

const { AppSidebar } = await import("../AppSidebar");
const { ShellHeader } = await import("../ShellHeader");
const { AppSettingsProvider, fixedStore } = await import("../../state/use-app-settings");
const { ExecutionGate } = await import("./ExecutionGate");
const { HiddenScreenSlot } = await import("./HiddenScreenSlot");
const { HiddenScreenNotice } = await import("./HiddenScreenNotice");

const noop = () => {};

function shell(execution: AgentExecution, current: Screen | null = null) {
  const project = kiboProject();
  return render(
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>
      <SidebarProvider>
        <AppSidebar
          projects={projectsFixture}
          active={project}
          activeTarget={current ? { kind: "screen", screen: current } : null}
          screen={current}
          agents={agentsFixture()}
          changes={null}
          mineCount={2}
          inboxCount={3}
          workspaceName="Galadrim"
          workspaceIcon={null}
          viewer="adam"
          onHelp={noop}
          onOpen={noop}
          onSearch={noop}
          onNewProject={noop}
          onNewPage={noop}
          onRenamePage={noop}
          onDeletePage={noop}
          onShare={noop}
          onEditProject={noop}
          onDeleteProject={noop}
          onJoin={noop}
        />
        <ShellHeader
          active={{ kind: "project", projectId: project.meta.id }}
          screen={current}
          project={project}
          branch={null}
          gitError={null}
          agents={agentsFixture()}
          agentPanel={{ available: true, open: false, toggle: noop, show: noop }}
          notifications="browser"
          now={NOW}
          onNewAgent={noop}
          onNewSkill={noop}
          onOpenRun={noop}
          onOpen={noop}
        />
        <ExecutionGate>
          <section aria-label="Runs" />
        </ExecutionGate>
      </SidebarProvider>
    </AppSettingsProvider>,
  );
}

test("hidden execution drops Agents, its sub-entries, its run badge, the run history and the agent bar", async () => {
  shell("hidden", "inbox");
  expect(await screen.findByRole("button", { name: /Boîte de réception/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Agents/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Files d'attente" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Skills" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Historique des runs/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "Runs" })).toBeNull();
});

test("shown execution brings Agents with its run badge, its sub-entries, the run history and the agent bar back", async () => {
  shell("shown", "queue");
  const agents = await screen.findByRole("button", { name: /^Agents/ });
  expect(agents.closest("li")?.textContent).toContain(String(agentsFixture().host.used));
  expect(screen.getByRole("button", { name: "Files d'attente" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Skills" })).toBeTruthy();
  expect(await screen.findByRole("button", { name: /Historique des runs/ })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Runs" })).toBeTruthy();
});

test("the inbox and the project agent stay whatever the setting", async () => {
  for (const execution of ["hidden", "shown"] as const) {
    const view = shell(execution);
    expect(await screen.findByRole("button", { name: /Boîte de réception/ })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Agent de projet/ })).toBeTruthy();
    view.unmount();
  }
});

function notice(execution: AgentExecution, current: Screen | null, onOpen: (t: TabTarget) => void = noop) {
  return render(
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>
      <HiddenScreenSlot screen={current} onOpen={onOpen} />
    </AppSettingsProvider>,
  );
}

test("an execution screen opened while hidden explains why and links to the general settings", async () => {
  const opened: TabTarget[] = [];
  notice("hidden", "agents", (t) => opened.push(t));
  expect((await screen.findByRole("status")).textContent).toContain("L'exécution des agents est masquée.");
  await userEvent.setup().click(screen.getByRole("button", { name: "Afficher dans Paramètres › Général" }));
  expect(opened).toEqual([{ kind: "screen", screen: "general" }]);
});

test("no notice when execution is shown or on another screen", () => {
  notice("shown", "queue");
  expect(screen.queryByRole("status")).toBeNull();
  notice("hidden", "inbox");
  expect(screen.queryByRole("status")).toBeNull();
});

test("hidden execution: an Agents screen opened by URL has no Nouvel agent action", async () => {
  shell("hidden", "agents");
  expect(await screen.findByRole("button", { name: /Boîte de réception/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Nouvel agent" })).toBeNull();
});

test("shown execution: the Agents screen offers Nouvel agent again", async () => {
  shell("shown", "agents");
  expect(await screen.findByRole("button", { name: "Nouvel agent" })).toBeTruthy();
});

const skillTab = (execution: AgentExecution) =>
  render(
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>
      <ExecutionGate fallback={<HiddenScreenNotice onOpen={noop} />}>
        <p>Skill brainstorming</p>
      </ExecutionGate>
    </AppSettingsProvider>,
  );

test("hidden execution: a skill tab shows the notice instead of the skill", async () => {
  skillTab("hidden");
  expect((await screen.findByRole("status")).textContent).toContain("L'exécution des agents est masquée.");
  expect(screen.queryByText("Skill brainstorming")).toBeNull();
});

test("shown execution: a skill tab shows the skill again", () => {
  skillTab("shown");
  expect(screen.getByText("Skill brainstorming")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});

test("run and skill tabs, and the agent screens, are execution targets; the rest is not", async () => {
  const { isExecutionTarget } = await import("./execution-visibility");
  expect(isExecutionTarget({ kind: "run", runId: "r1" })).toBe(true);
  expect(isExecutionTarget({ kind: "skill", skillId: "superpowers:brainstorming" })).toBe(true);
  expect(isExecutionTarget({ kind: "screen", screen: "queue" })).toBe(true);
  expect(isExecutionTarget({ kind: "screen", screen: "inbox" })).toBe(false);
  expect(isExecutionTarget({ kind: "ticket", projectId: "p1", ticketId: "t1" })).toBe(false);
});
