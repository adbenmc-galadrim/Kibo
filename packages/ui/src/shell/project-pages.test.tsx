import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, KiboError, type Page, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { SidebarMenu, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return answer(req);
      },
      subscribe: () => () => {},
      subscribeTopic: () => () => {},
      subscribeEvents: () => () => {},
    },
  }),
);
const { ProjectPages } = await import("./ProjectPages");

const page = (id: string, title: string, parentId: string | null): Page => ({
  id,
  title,
  kind: "view",
  parentId,
});
const project = (access: ProjectSnapshot["sync"]["access"] = "write"): ProjectSnapshot => ({
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [
    page("dash", "Tableau de bord", null),
    page("kanban", "Kanban", null),
    page("k1", "Sprint", "kanban"),
  ],
  tickets: [],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sprints: [],
  sync: { shared: access !== "write", keyAllocator: "local", role: null, access, members: [] },
});
const show = (access: ProjectSnapshot["sync"]["access"] = "write") => {
  const onOpen = mock((_t: unknown, _newTab: boolean, _keep?: boolean) => {});
  const onNewPage = mock((_parentId: string | null) => {});
  const onRenamePage = mock((_p: Page) => {});
  const onDeletePage = mock((_p: Page) => {});
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectPages
            project={project(access)}
            activeTarget={null}
            header={<span>Kibo</span>}
            onOpen={onOpen}
            onNewPage={onNewPage}
            onRenamePage={onRenamePage}
            onDeletePage={onDeletePage}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
  return { onOpen, onNewPage, onRenamePage, onDeletePage, user: userEvent.setup() };
};
const command = (req: RpcRequest | undefined) => (req?.method === "command" ? req.command : null);

beforeEach(() => {
  calls.length = 0;
  answer = () => null;
});

test("a click opens a page as a preview, a double click opens it kept", async () => {
  const { user, onOpen } = show();
  const kanban = screen.getByRole("button", { name: "Kanban" });
  await user.click(kanban);
  expect(onOpen).toHaveBeenLastCalledWith({ kind: "page", projectId: "p1", pageId: "kanban" }, false);
  await user.dblClick(kanban);
  expect(onOpen).toHaveBeenLastCalledWith({ kind: "page", projectId: "p1", pageId: "kanban" }, false, true);
});

test("right click on a page opens its menu; the entries call back or send movePage", async () => {
  const { user, onOpen, onNewPage, onRenamePage, onDeletePage } = show();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitem")
      .map((i) => i.textContent),
  ).toEqual([
    "Ouvrir dans un nouvel onglet",
    "Nouvelle sous-page",
    "Renommer…",
    "Monter",
    "Descendre",
    "Déplacer vers",
    "Supprimer…",
  ]);
  await user.click(within(menu).getByRole("menuitem", { name: "Ouvrir dans un nouvel onglet" }));
  expect(onOpen).toHaveBeenLastCalledWith({ kind: "page", projectId: "p1", pageId: "kanban" }, true);
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
  expect(command(calls.at(-1))).toEqual({ method: "movePage", pageId: "kanban", parentId: null, index: 0 });
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Nouvelle sous-page" }));
  expect(onNewPage).toHaveBeenLastCalledWith("kanban");
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Renommer…" }));
  expect(onRenamePage).toHaveBeenLastCalledWith(expect.objectContaining({ id: "kanban" }));
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  expect(onDeletePage).toHaveBeenLastCalledWith(expect.objectContaining({ id: "kanban" }));
});

test("the ⋯ button carries the same entries and Déplacer vers sends movePage to the target", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Actions de la page Sprint" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  const items = await screen.findAllByRole("menuitem", { name: /Racine|Tableau de bord|Kanban/ });
  expect(items.map((i) => i.textContent)).toEqual(["Racine", "Tableau de bord", "Kanban"]);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement?.textContent).toBe("Racine");
  await user.keyboard("{Enter}");
  expect(command(calls.at(-1))).toEqual({ method: "movePage", pageId: "k1", parentId: null });
});

test("a refused move is shown as an alert", async () => {
  answer = () => {
    throw new KiboError("TREE_CYCLE", "cycle");
  };
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Actions de la page Kanban" }));
  await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de déplacer la page.");
});

test("a read-only project has no ⋯ button and a one-entry menu", async () => {
  const { user } = show("read-only");
  expect(screen.queryByRole("button", { name: /Actions de la page/ })).toBeNull();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir dans un nouvel onglet",
  ]);
});

test("each editable row carries three hidden drop zones and keeps its button and menu", async () => {
  const { user } = show();
  const row = screen.getByRole("button", { name: "Kanban" }).closest("li");
  const zones = Array.from(row?.querySelectorAll("[data-drop-zone]") ?? []);
  expect(zones.map((z) => z.getAttribute("data-drop-zone"))).toEqual([
    "before",
    "inside",
    "after",
    "before",
    "inside",
    "after",
  ]);
  expect(zones.every((z) => z.getAttribute("aria-hidden") === "true")).toBe(true);
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  expect(await screen.findAllByRole("menuitem")).toHaveLength(7);
});

test("a read-only project renders no drop zone", () => {
  show("read-only");
  expect(document.querySelectorAll("[data-drop-zone]")).toHaveLength(0);
});

test("an open feature lights the Planning page of its project", async () => {
  const { emisFeatureProject } = await import("./feature/fixture");
  const emis = emisFeatureProject();
  const planned: ProjectSnapshot = {
    ...emis,
    pages: [page("p-plan", "Planning", null), page("p-tickets", "Tickets", null)],
    instances: [
      {
        id: "i-plan",
        pageId: "p-plan",
        component: "planning@1.0.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  const pages = (ticketId: string) =>
    render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <ProjectPages
              project={planned}
              activeTarget={{ kind: "ticket", projectId: "emis", ticketId }}
              header={<span>Emis</span>}
              onOpen={() => {}}
              onNewPage={() => {}}
              onRenamePage={() => {}}
              onDeletePage={() => {}}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
  const first = pages("f5");
  expect(screen.getByRole("button", { name: "Planning" }).getAttribute("aria-current")).toBe("page");
  first.unmount();
  pages("e33");
  expect(screen.getByRole("button", { name: "Planning" }).getAttribute("aria-current")).toBeNull();
});

test("the ⋯ of a view page also carries its component menu", async () => {
  const withView: ProjectSnapshot = {
    ...project(),
    instances: [
      {
        id: "i-kanban",
        pageId: "kanban",
        component: "kanban@1.0.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  const user = userEvent.setup();
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectPages
            project={withView}
            activeTarget={null}
            header={<span>Kibo</span>}
            onOpen={() => {}}
            onNewPage={() => {}}
            onRenamePage={() => {}}
            onDeletePage={() => {}}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Actions de la page Kanban" }));
  expect(await screen.findByRole("menuitem", { name: "Retirer de la page…" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Renommer…" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions de la page Tableau de bord" }));
  await screen.findByRole("menuitem", { name: "Renommer…" });
  expect(screen.queryByRole("menuitem", { name: "Retirer de la page…" })).toBeNull();
});

const countedPages = async (access: ProjectSnapshot["sync"]["access"]) => {
  const { emisFeatureProject } = await import("./feature/fixture");
  const emis = emisFeatureProject();
  const counted: ProjectSnapshot = {
    ...emis,
    sync: { ...emis.sync, access },
    pages: [page("p-tickets", "Tickets", null)],
    instances: [
      {
        id: "i-tickets",
        pageId: "p-tickets",
        component: "tickets@1.0.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectPages
            project={counted}
            activeTarget={null}
            header={<span>Emis</span>}
            onOpen={() => {}}
            onNewPage={() => {}}
            onRenamePage={() => {}}
            onDeletePage={() => {}}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
  const row = screen.getByRole("button", { name: "Tickets" });
  const count = row.querySelector(".k-count");
  if (count === null) throw new Error("the Tickets row shows no count");
  return { row, count };
};

test("the ⋯ of an editable row shows for its own row only and its count yields to it", async () => {
  const { row, count } = await countedPages("write");
  const line = row.parentElement;
  expect(line?.classList.contains("k-page-row")).toBe(true);
  expect(count.classList.contains("k-yield")).toBe(true);
  const action = line?.querySelector('[data-sidebar="menu-action"]');
  expect(action?.classList.contains("k-page-action")).toBe(true);
  expect(action?.className).not.toContain("group-hover/menu-item");
  expect(action?.className).not.toContain("group-focus-within/menu-item");
});

test("the count of a read-only row has no ⋯ to yield to and stays shown", async () => {
  const { count } = await countedPages("read-only");
  expect(count.classList.contains("k-yield")).toBe(false);
});

test("the sidebar style shows the ⋯ and hides the count together, row by row", async () => {
  const css = await Bun.file(new URL("./nav/shell.css", import.meta.url)).text();
  const rule = (selector: RegExp) => expect(css).toMatch(selector);
  rule(/@media \(min-width: 48rem\) \{\s*\.k-page-action \{\s*opacity: 0;/);
  rule(/@media \(max-width: 47\.99rem\) \{\s*\.k-yield \{\s*visibility: hidden;/);
  rule(
    /\.k-page-row:hover > \.k-page-action,\s*\.k-page-row:focus-within > \.k-page-action,\s*\.k-page-action\[data-state="open"\] \{\s*opacity: 1;/,
  );
  rule(
    /\.k-page-row:hover > \.k-row > \.k-yield,\s*\.k-page-row:focus-within > \.k-row > \.k-yield,\s*\.k-page-row:has\(> \.k-page-action\[data-state="open"\]\) > \.k-row > \.k-yield \{\s*visibility: hidden;/,
  );
});
