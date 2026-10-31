import { afterEach, expect, mock, test } from "bun:test";
import type { Screen } from "@kibo/schema";
import { SidebarProvider, SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { House } from "lucide-react";
import { apiMock } from "../api-mock";
import { kiboProject, projectsFixture } from "../lib/fixtures";

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
const { NavRow } = await import("./nav/NavRow");

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

const withPages = () => ({
  ...kiboProject(),
  pages: [
    { id: "1@1", title: "Vue d'ensemble", kind: "view" as const, parentId: null },
    { id: "2@1", title: "Planning", kind: "view" as const, parentId: null },
  ],
});

function sidebar(
  current: Screen | null = null,
  open = true,
  onOpen: (t: unknown, newTab: boolean) => void = noop,
) {
  return render(
    <SidebarProvider defaultOpen={open}>
      <SidebarTrigger />
      <AppSidebar
        projects={projectsFixture}
        active={withPages()}
        snapshots={new Map([["kibo", withPages()]])}
        activeTarget={current ? { kind: "screen", screen: current } : null}
        screen={current}
        workspaceName="Galadrim"
        workspaceIcon={null}
        viewer="adam"
        onHelp={noop}
        onOpen={onOpen}
        onSearch={noop}
        onNewProject={noop}
        onNewPage={noop}
        onRenamePage={noop}
        onDeletePage={noop}
        onEditProject={noop}
        onDeleteProject={noop}
      />
    </SidebarProvider>,
  );
}

test("the sidebar keeps the tracking entries only, even on a retired screen", async () => {
  viewport(1440);
  sidebar("domains");
  expect(await screen.findByRole("button", { name: /^Aujourd'hui/ })).toBeTruthy();
  await act(() => Bun.sleep(150));
  for (const name of [/^Agents/, /^Files d'attente/, /^Skills/, /^Créations/, /^Composants/, /^Changements/])
    expect(screen.queryByRole("button", { name })).toBeNull();
});

test("the sidebar has Aujourd'hui, Projets, Paramètres and no counters", async () => {
  viewport(1440);
  sidebar();
  const today = await screen.findByRole("button", { name: "Aujourd'hui" });
  expect(today.getAttribute("data-active")).toBe("true");
  expect(today.querySelector(".k-count")).toBeNull();
  expect(screen.getByText("Projets")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Paramètres" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Mes tickets/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Boîte de réception/ })).toBeNull();
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
  render(<NavRow icon={House} label="Questions" count="12" />);
  const count = (await screen.findByRole("button", { name: /^Questions/ })).querySelector(".k-count");
  expect(count?.className).toContain("whitespace-nowrap");
});

test("the folded sidebar shows each project by its initials, its name and pages on hover or click", async () => {
  viewport(1024);
  const opened: unknown[] = [];
  sidebar(null, false, (t, newTab) => opened.push([t, newTab]));
  const user = userEvent.setup();
  const kibo = () => screen.getByRole("button", { name: "Kibo" });
  await waitFor(() => expect(kibo().getAttribute("data-state")).toBe("closed"));
  expect(kibo().textContent).toBe("K");
  await user.click(kibo());
  const menu = await screen.findByRole("navigation", { name: "Pages de Kibo" });
  expect(menu.textContent).toContain("Kibo");
  await user.click(await screen.findByRole("button", { name: "Planning" }));
  expect(opened).toEqual([[{ kind: "page", projectId: "kibo", pageId: "2@1" }, false]]);
});

test("under 48 rem the sheet opened over the page lists each project in full, not by its initials", async () => {
  viewport(700);
  const width = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });
  try {
    sidebar(null, false);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(await screen.findByRole("button", { name: "Planning" })).toBeDefined();
    expect(screen.queryByRole("navigation", { name: "Pages de Kibo" })).toBeNull();
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  }
});
