import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, AiEvent, ComponentDraft, RpcRequest, Screen, TabTarget } from "@kibo/schema";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { act, render as renderPlain, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { agentsFixture, kiboProject, NOW, runFixture } from "../agents/fixtures";
import { draftFixture } from "../ai/draft-fixtures";
import { apiMock } from "../api-mock";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";

const shownExecution = fixedStore({ agentExecution: "shown" });
const ShownExecution = ({ children }: { children: ReactNode }) => (
  <AppSettingsProvider store={shownExecution}>{children}</AppSettingsProvider>
);
const render = (ui: ReactElement) => renderPlain(ui, { wrapper: ShownExecution });

let drafts: ComponentDraft[] = [];
const aiListeners = new Set<(e: AiEvent) => void>();
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => (req.method === "listComponentDrafts" ? drafts : null),
      subscribeAi: (l: (e: AiEvent) => void) => {
        aiListeners.add(l);
        return () => aiListeners.delete(l);
      },
      subscribeTopic: () => () => {},
      subscribeEvents: () => () => {},
      online: () => true,
      onConnection: () => () => {},
    },
  }),
);

const realAgents = await import("../state/use-agents");
mock.module("../state/use-agents", () => ({ ...realAgents, useDaemonOnline: () => true }));

const { ShellHeader } = await import("./ShellHeader");

const review = draftFixture({ id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11", status: "review", runId: null });
const generating = draftFixture({
  id: "1c6d2f4e-8b62-4e3b-8d2f-3a1e7a2c9b22",
  status: "generating",
  runId: "r9",
});
const agents = (): AgentsState => ({
  ...agentsFixture(),
  runs: [runFixture({ id: "r9", state: "running" })],
});

type HeaderOver = { screen?: Screen | null; onNewAgent?(): void; onNewSkill?(): void };

function header(onOpen: (t: TabTarget) => void = () => {}, over: HeaderOver = {}) {
  return render(
    <SidebarProvider>
      <ShellHeader
        active={null}
        screen={over.screen ?? null}
        project={null}
        branch={null}
        gitError={null}
        agents={agents()}
        agentPanel={{ available: false, open: false, toggle: () => {}, show: () => {} }}
        notifications="browser"
        now={NOW}
        onNewAgent={over.onNewAgent ?? (() => {})}
        onNewSkill={over.onNewSkill ?? (() => {})}
        onOpenRun={() => {}}
        onOpen={onOpen}
      />
    </SidebarProvider>,
  );
}

beforeEach(() => {
  drafts = [];
  aiListeners.clear();
});

test("screen 131: without an active creation there is no Créations button", async () => {
  drafts = [draftFixture({ status: "done" })];
  header();
  await waitFor(() => expect(screen.getByRole("button", { name: /Historique des runs/ })).toBeTruthy());
  await act(async () => {});
  expect(screen.queryByRole("button", { name: /^Créations/ })).toBeNull();
});

test("screen 131: the button counts awaiting creations, pulses while one generates and opens the screen", async () => {
  drafts = [review, generating];
  const opened: TabTarget[] = [];
  header((t) => opened.push(t));
  const button = await screen.findByRole("button", { name: "Créations · 1 attend une action, 1 en cours" });
  expect(button.textContent).toBe("1");
  expect(button.getAttribute("data-busy")).toBe("true");
  await userEvent.setup().click(button);
  expect(opened).toEqual([{ kind: "screen", screen: "creations" }]);
});

test("the indicator follows draft.changed and disappears once every creation is finished", async () => {
  drafts = [review];
  header();
  expect(await screen.findByRole("button", { name: "Créations · 1 attend une action" })).toBeTruthy();
  drafts = [{ ...review, status: "done" }];
  await act(async () => {
    for (const l of aiListeners) l({ type: "draft.changed", draftId: review.id, status: "done" });
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Créations/ })).toBeNull());
});

test("the project agent button toggles the panel and carries a dot while a batch waits", async () => {
  const toggled: string[] = [];
  const waiting = (pendingBatchId: string | null): AgentsState => ({
    ...agents(),
    projectAgents: [{ projectId: "kibo", runId: "pa1", state: "done", pendingBatchId }],
  });
  const props = (state: AgentsState) => (
    <SidebarProvider>
      <ShellHeader
        active={{ kind: "project", projectId: "kibo" }}
        screen={null}
        project={kiboProject()}
        branch={null}
        gitError={null}
        agents={state}
        agentPanel={{
          available: true,
          open: false,
          toggle: () => toggled.push("toggle"),
          show: () => toggled.push("signals"),
        }}
        notifications="browser"
        now={NOW}
        onNewAgent={() => {}}
        onNewSkill={() => {}}
        onOpenRun={() => {}}
        onOpen={() => {}}
      />
    </SidebarProvider>
  );
  const view = render(props(waiting(null)));
  const button = await screen.findByRole("button", { name: "Agent de projet" });
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("button", { name: "Partager" })).toBeNull();
  await userEvent.setup().click(button);
  expect(toggled).toEqual(["toggle"]);
  view.rerender(props(waiting("b1")));
  expect(screen.getByRole("button", { name: "Agent de projet · Un lot attend ta validation" })).toBeTruthy();
  view.rerender(props({ ...waiting("b1"), signals: [{ projectId: "kibo", open: 2, unread: 1 }] }));
  expect(screen.getByRole("button", { name: "Agent de projet · 2 signaux en boîte" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir la boîte à signaux" }));
  expect(toggled).toEqual(["toggle", "signals"]);
});

test("the creations indicator loads on demand: nothing shows while loading, then the button", async () => {
  drafts = [review];
  header();
  expect(screen.queryByText("Chargement…")).toBeNull();
  expect(await screen.findByRole("button", { name: "Créations · 1 attend une action" })).toBeTruthy();
  expect(document.querySelector("[data-kibo-loading]:not(.sr-only)")).toBeNull();
});

test("the header offers Nouvel agent on Agents and Nouveau skill on Skills", async () => {
  const calls: string[] = [];
  const view = header(() => {}, { screen: "skills", onNewSkill: () => calls.push("skill") });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nouveau skill" }));
  view.unmount();
  header(() => {}, { screen: "agents", onNewAgent: () => calls.push("agent") });
  await user.click(await screen.findByRole("button", { name: "Nouvel agent" }));
  expect(calls).toEqual(["skill", "agent"]);
});

test("the header keeps the breadcrumb, the sync state and the actions; share, ticket and account live elsewhere", async () => {
  const project = { ...kiboProject(), sync: { ...kiboProject().sync, shared: true } };
  render(
    <SidebarProvider>
      <ShellHeader
        active={{ kind: "project", projectId: "kibo" }}
        screen={null}
        project={project}
        branch={null}
        gitError={null}
        agents={agents()}
        agentPanel={{ available: true, open: false, toggle: () => {}, show: () => {} }}
        notifications="browser"
        now={NOW}
        onNewAgent={() => {}}
        onNewSkill={() => {}}
        onOpenRun={() => {}}
        onOpen={() => {}}
      />
    </SidebarProvider>,
  );
  expect(await screen.findByText(/^Synchronisé/)).toBeTruthy();
  for (const name of ["Partager", /^Ticket/, /^Menu de/, "Afficher ou masquer la barre latérale"])
    expect(screen.queryByRole("button", { name })).toBeNull();
});

const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const closedHeader = (matches: boolean) => {
  window.matchMedia = (media: string) =>
    Object.assign(new EventTarget(), {
      matches,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as MediaQueryList;
  render(
    <SidebarProvider defaultOpen={false}>
      <ShellHeader
        active={null}
        screen={null}
        project={null}
        branch={null}
        gitError={null}
        agents={null}
        agentPanel={{ available: false, open: false, toggle: () => {}, show: () => {} }}
        notifications="browser"
        now={NOW}
        onNewAgent={() => {}}
        onNewSkill={() => {}}
        onOpenRun={() => {}}
        onOpen={() => {}}
      />
    </SidebarProvider>,
  );
};

test("the sidebar toggle shows in the header once the sidebar is closed", () => {
  closedHeader(false);
  expect(screen.getByRole("button", { name: "Afficher ou masquer la barre latérale" })).toBeTruthy();
});

test("under 1180 px the folded rail keeps the toggle, the header does not repeat it", () => {
  closedHeader(true);
  expect(screen.queryByRole("button", { name: "Afficher ou masquer la barre latérale" })).toBeNull();
});
