import { afterEach, expect, mock, test } from "bun:test";
import type { AgentsState } from "@kibo/schema";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture, kiboProject, runFixture } from "../lib/fixtures";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async () => null,
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

const agents = (): AgentsState => ({
  ...agentsFixture(),
  runs: [runFixture({ id: "r9", state: "running" })],
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
          show: () => toggled.push("show"),
        }}
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
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir l'agent de projet" }));
  expect(toggled).toEqual(["toggle", "show"]);
});

test("the header keeps the breadcrumb and the actions, without any sync state while online", async () => {
  const project = kiboProject();
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
        onOpen={() => {}}
      />
    </SidebarProvider>,
  );
  expect(await screen.findByRole("navigation", { name: "Fil d'Ariane" })).toBeTruthy();
  expect(screen.queryByText(/Synchronisé/)).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
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
