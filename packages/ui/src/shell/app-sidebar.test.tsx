import { afterEach, expect, mock, test } from "bun:test";
import type { Screen } from "@kibo/schema";
import { SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject, projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";

mock.module("../api", () =>
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

const { AppSidebar } = await import("./AppSidebar");
const { AppSettingsProvider, fixedStore } = await import("../state/use-app-settings");

const realMatchMedia = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
});

const viewport = (width: number) => {
  window.matchMedia = (query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)?.[1];
    const matches = max !== undefined && width <= Number(max);
    return Object.assign(new EventTarget(), {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as MediaQueryList;
  };
};

const noop = () => {};

function sidebar(current: Screen | null = null, open = true) {
  return render(
    <AppSettingsProvider store={fixedStore({ agentExecution: "shown" })}>
      <SidebarProvider defaultOpen={open}>
        <AppSidebar
          projects={projectsFixture}
          active={kiboProject()}
          activeTarget={current ? { kind: "screen", screen: current } : null}
          screen={current}
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
      </SidebarProvider>
    </AppSettingsProvider>,
  );
}

test("the sidebar keeps the tracking entries only, even on an agent screen", async () => {
  viewport(1440);
  sidebar("queue");
  expect(await screen.findByRole("button", { name: /Boîte de réception/ })).toBeTruthy();
  await act(() => Bun.sleep(150));
  expect(screen.getByRole("button", { name: /^Accueil/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Mes tickets/ })).toBeTruthy();
  for (const name of [/^Agents/, /^Files d'attente/, /^Skills/, /^Créations/, /^Composants/, /^Changements/])
    expect(screen.queryByRole("button", { name })).toBeNull();
});

test("the workspace menu no longer offers Composants nor Changements", async () => {
  viewport(1440);
  sidebar();
  await userEvent.setup().click(screen.getByRole("button", { name: /Galadrim/ }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual(["GaladrimWorkspace local", "Paramètres du workspace"]);
});

test("under 1180 px the closed sidebar folds into icons", () => {
  viewport(1024);
  const { container } = sidebar(null, false);
  expect(container.querySelector("[data-slot=sidebar]")?.getAttribute("data-collapsible")).toBe("icon");
});

test("from 1180 px the closed sidebar slides off as before", () => {
  viewport(1180);
  const { container } = sidebar(null, false);
  expect(container.querySelector("[data-slot=sidebar]")?.getAttribute("data-collapsible")).toBe("offcanvas");
});

test("counts and sprint codes never wrap", async () => {
  viewport(1440);
  sidebar();
  const count = (await screen.findByRole("button", { name: /^Mes tickets/ })).querySelector(".k-count");
  expect(count?.className).toContain("whitespace-nowrap");
});
