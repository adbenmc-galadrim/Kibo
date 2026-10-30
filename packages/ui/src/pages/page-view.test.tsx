import { expect, mock, test } from "bun:test";
import type { Page, ProjectSnapshot } from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { kiboProject } from "../lib/fixtures";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: () => Promise.resolve(null),
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { PageView } = await import("./PageView");
const { HostProvider } = await import("../shell/Host");
const { PageActionsProvider, PageActionsSlot } = await import("../shell/page-actions");

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const dashboard: Page = { id: "pg", title: "Tableau de bord", kind: "dashboard", parentId: null };
const single: Page = { id: "pg", title: "Kanban", kind: "view", parentId: null };
const withPage = (page: Page = dashboard): ProjectSnapshot => {
  const base = kiboProject();
  return {
    ...base,
    pages: [page],
    instances: [
      {
        id: "i1",
        pageId: "pg",
        component: "kanban@1.0.0",
        layout: { x: 0, y: 0, w: 6, h: 6 },
        config: {},
        componentHash: null,
      },
    ],
  };
};
const show = (project: ProjectSnapshot, page: Page = dashboard) =>
  render(
    <HostProvider host={host}>
      <PageActionsProvider>
        <PageActionsSlot />
        <PageView project={project} page={page} viewer="adam" />
      </PageActionsProvider>
    </HostProvider>,
  );

test("an editable project offers the widget menu", async () => {
  show(withPage());
  await userEvent.setup().click(await screen.findByRole("button", { name: "Actions Kanban" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Réglages…",
    "Retirer de la page…",
  ]);
});

test("a single-widget page leaves its widget menu to the page row of the sidebar", async () => {
  show(withPage(single), single);
  await waitFor(() => expect(screen.queryByText("Chargement…")).toBeNull());
  expect(screen.queryByRole("button", { name: "Actions Kanban" })).toBeNull();
});

test("a single-widget page gives its component the height left under the page headers", async () => {
  const { container } = show(withPage(single), single);
  await waitFor(() => expect(screen.queryByText("Chargement…")).toBeNull());
  const body = container.querySelector("[data-view-body]");
  expect(body?.className.split(" ")).toEqual(
    expect.arrayContaining(["flex", "min-h-0", "flex-1", "flex-col"]),
  );
  expect(body?.parentElement?.className.split(" ")).toEqual(expect.arrayContaining(["h-full", "min-h-0"]));
});

const twoWidgets = (): ProjectSnapshot => {
  const base = withPage();
  return {
    ...base,
    instances: [
      {
        id: "i2",
        pageId: "pg",
        component: "tickets@1.0.0",
        layout: { x: 0, y: 3, w: 6, h: 3 },
        config: {},
        componentHash: null,
      },
      {
        id: "i1",
        pageId: "pg",
        component: "kanban@1.0.0",
        layout: { x: 0, y: 0, w: 6, h: 6 },
        config: {},
        componentHash: null,
      },
    ],
  };
};
const cells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-instance]"));
const withWidth = (wide: boolean, run: () => Promise<void>) => async () => {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  try {
    await run();
  } finally {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: original });
  }
};

test(
  "screen 129: a stored state is rendered compacted, without writing",
  withWidth(true, async () => {
    const project = twoWidgets();
    const floating = project.instances.map((i) =>
      i.id === "i1" ? { ...i, layout: { x: 0, y: 4, w: 6, h: 6 } } : i,
    );
    const { container } = show(project);
    await screen.findAllByText("Kanban");
    const [first, second] = cells(container);
    expect(first?.dataset.instance).toBe("i1");
    expect(first?.style.gridRow).toBe("1 / span 6");
    expect(second?.style.gridRow).toBe("7 / span 3");
    expect(second?.style.gridColumn).toBe("1 / span 6");
    cleanup();
    const gap = show({ ...project, instances: floating });
    await screen.findAllByText("Kanban");
    expect(cells(gap.container).map((c) => c.style.gridRow)).toEqual(["1 / span 3", "4 / span 6"]);
  }),
);

test(
  "screen 129: a narrow window shows one column in reading order and no layout mode",
  withWidth(false, async () => {
    const { container } = show(twoWidgets());
    await screen.findAllByText("Kanban");
    const list = cells(container);
    expect(list.map((c) => c.dataset.instance)).toEqual(["i1", "i2"]);
    for (const c of list) {
      expect(c.style.gridColumn).toBe("");
      expect(c.style.gridRow).toBe("");
    }
    expect(list[0]?.style.height).toBe("560px");
    expect(list[0]?.parentElement?.className).toContain("grid-cols-1");
    expect(screen.queryByRole("button", { name: "Modifier la disposition" })).toBeNull();
    expect(screen.getByText("Élargis la fenêtre pour modifier la disposition.")).toBeTruthy();
  }),
);

test(
  "the layout mode is offered on a wide editable dashboard only",
  withWidth(true, async () => {
    const user = userEvent.setup();
    const editable = show(twoWidgets());
    await user.click(await screen.findByRole("button", { name: "Modifier la disposition" }));
    expect(await screen.findByRole("toolbar", { name: "Disposition" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déplacer Kanban" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Modifier la disposition" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(await screen.findByRole("button", { name: "Modifier la disposition" })).toBeTruthy();
    editable.unmount();
  }),
);

test("the Vue d'ensemble page puts « Nouveau ticket » in the shell header, Tickets keeps its own", async () => {
  const opened: unknown[] = [];
  const overviewPage: Page = { id: "pg", title: "Vue d'ensemble", kind: "view", parentId: null };
  const withComponent = (component: string): ProjectSnapshot => {
    const base = withPage(overviewPage);
    return { ...base, instances: base.instances.map((i) => ({ ...i, component })) };
  };
  const mountWith = (project: ProjectSnapshot) =>
    render(
      <HostProvider host={{ ...host, openNewTicket: (d) => opened.push(d) }}>
        <PageActionsProvider>
          <PageActionsSlot />
          <PageView project={project} page={overviewPage} viewer="adam" />
        </PageActionsProvider>
      </HostProvider>,
    );
  const view = mountWith(withComponent("overview@1.0.0"));
  await userEvent.setup().click(await screen.findByRole("button", { name: "Nouveau ticket" }));
  expect(opened).toEqual([{}]);
  view.unmount();
  const slotButtons = (v: ReturnType<typeof mountWith>) =>
    v.container.firstElementChild?.querySelectorAll("button").length ?? 0;
  const tickets = mountWith(withComponent("tickets@1.0.0"));
  expect(slotButtons(tickets)).toBe(0);
  tickets.unmount();
  cleanup();
});
