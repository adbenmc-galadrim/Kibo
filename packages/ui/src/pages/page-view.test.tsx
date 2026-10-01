import { expect, mock, test } from "bun:test";
import type { Page, ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject } from "../agents/fixtures";

const LOCAL = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "listComponents") return Promise.resolve([]);
      if (req.method === "getPresence") return Promise.resolve([]);
      if (req.method === "componentCall" && req.call.kind === "presence.list") return Promise.resolve([]);
      if (req.method === "componentCall" && req.call.kind === "sharing.get") return Promise.resolve(LOCAL);
      return Promise.resolve(null);
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { PageView } = await import("./PageView");
const { HostProvider } = await import("../shell/Host");
const { PageActionsProvider, PageActionsSlot } = await import("../shell/page-actions");

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const dashboard: Page = { id: "pg", title: "Tableau de bord", kind: "dashboard", parentId: null };
const single: Page = { id: "pg", title: "Kanban", kind: "view", parentId: null };
const withAccess = (access: "write" | "read-only" | "revoked", page: Page = dashboard): ProjectSnapshot => {
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
    sync: { ...base.sync, shared: true, access },
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
  show(withAccess("write"));
  await userEvent.setup().click(await screen.findByRole("button", { name: "Actions Kanban" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Réglages…",
    "Retirer de la page…",
  ]);
});

test("a read-only or revoked project shows no widget menu", async () => {
  for (const access of ["read-only", "revoked"] as const) {
    const view = show(withAccess(access));
    expect(await screen.findByText("Kanban")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Actions Kanban" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Réglages…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Retirer de la page…" })).toBeNull();
    view.unmount();
  }
});

test("an editable single-widget page offers the widget menu in the page actions", async () => {
  show(withAccess("write", single), single);
  expect(await screen.findByRole("button", { name: "Actions Kanban" })).toBeTruthy();
});

test("a read-only or revoked single-widget page shows no widget menu", async () => {
  for (const access of ["read-only", "revoked"] as const) {
    const view = show(withAccess(access, single), single);
    await waitFor(() => expect(screen.queryByText("Chargement…")).toBeNull());
    expect(screen.queryByRole("button", { name: "Actions Kanban" })).toBeNull();
    view.unmount();
  }
});

const twoWidgets = (access: "write" | "read-only" = "write"): ProjectSnapshot => {
  const base = withAccess(access);
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
  "screen 129: overlapping widgets are pushed down at render, without writing",
  withWidth(true, async () => {
    const { container } = show(twoWidgets());
    await screen.findAllByText("Kanban");
    const [first, second] = cells(container);
    expect(first?.dataset.instance).toBe("i1");
    expect(first?.style.gridRow).toBe("1 / span 6");
    expect(second?.style.gridRow).toBe("7 / span 3");
    expect(second?.style.gridColumn).toBe("1 / span 6");
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
