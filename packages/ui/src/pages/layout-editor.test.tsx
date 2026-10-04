import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  compactLayouts,
  type Instance,
  KiboError,
  type Layout,
  layoutFor,
  Page,
  type RpcRequest,
} from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      if (req.method === "listComponents" || req.method === "listDrafts") return [];
      calls.push(req);
      const out = answer(req);
      if (out instanceof Error) throw out;
      return out;
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { LayoutEditor } = await import("./LayoutEditor");
const { moveWidget, changedIds } = await import("./layout-draft");
const { cellMetrics, resolveOverlaps } = await import("../lib/format-grid");

const dashboard: Page = { id: "pg", title: "Tableau de bord", kind: "dashboard", parentId: null };
const widget = (id: string, component: string, layout: Layout): Instance => ({
  id,
  pageId: "pg",
  component,
  layout,
  config: {},
  componentHash: null,
});
const kanban = (layout: Layout) => widget("kanban", "kanban@1.0.0", layout);
const tickets = (layout: Layout) => widget("tickets", "tickets@1.0.0", layout);
let onClose = mock(() => {});

beforeEach(() => {
  calls.length = 0;
  answer = () => null;
  onClose = mock(() => {});
});

const show = (instances = [kanban(layoutFor("large", 0, 0)), tickets(layoutFor("large", 6, 0))]) =>
  render(
    <LayoutEditor
      projectId="p1"
      page={dashboard}
      instances={instances}
      formatsFor={() => ["medium", "large", "half", "full"]}
      renderWidget={(i) => <p>{i.component}</p>}
      onClose={onClose}
    />,
  );
const toolbar = () => screen.getByRole("toolbar", { name: "Disposition" });

describe("layout editor", () => {
  test("screen 127/128: Format menu offers the declared formats, disables what does not fit, and Save sends one command per change", async () => {
    const user = userEvent.setup();
    show();
    expect(toolbar().textContent).toContain("Aucun changement");
    expect(screen.getByRole("button", { name: "Déplacer Kanban" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Format de Tickets" }));
    expect(screen.getByRole("menuitemradio", { name: /Large · 6 × 6/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    const full = screen.getByRole("menuitemradio", { name: /Plein écran/ });
    expect(full.getAttribute("aria-disabled")).toBe("true");
    expect(full.textContent).toContain("Pas de place");
    expect(screen.getByText("Un composant s'adapte à chacun de ses formats.")).toBeTruthy();
    await user.click(screen.getByRole("menuitemradio", { name: /Moyen · 6 × 3/ }));
    expect(toolbar().textContent).toContain("1 changement");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls).toEqual([
      {
        method: "command",
        projectId: "p1",
        command: { method: "setInstanceLayout", instanceId: "tickets", layout: layoutFor("medium", 6, 0) },
      },
    ]);
  });

  test("widgets stacked at (0, 0) by addInstance save a new format in an order the core accepts", async () => {
    const user = userEvent.setup();
    const core = createMockSdk({
      id: "probe",
      version: "0.1.0",
      kind: "widget",
      title: "Probe",
      reads: [],
      writes: [],
    });
    const page = Page.parse(core.run({ method: "addPage", title: "Tableau de bord", kind: "dashboard" }));
    for (const component of ["kanban@1.0.0", "tickets@1.0.0", "graph@1.0.0"]) {
      core.run({ method: "addInstance", pageId: page.id, component });
    }
    answer = (req) => (req.method === "command" ? core.run(req.command) : null);
    const instances = core.snapshot().instances;
    const shown = resolveOverlaps(instances);
    const first = instances.find((i) => shown.get(i.id)?.y === 0);
    if (!first) throw new Error("no first widget");
    render(
      <LayoutEditor
        projectId="p1"
        page={{ ...dashboard, id: page.id }}
        instances={instances}
        formatsFor={() => ["medium", "large", "half"]}
        renderWidget={(i) => <p>{i.component}</p>}
        onClose={onClose}
      />,
    );
    const titles = new Map([
      ["kanban@1.0.0", "Kanban"],
      ["tickets@1.0.0", "Tickets"],
      ["graph@1.0.0", "Graphe de dépendances"],
    ]);
    await user.click(screen.getByRole("button", { name: `Format de ${titles.get(first.component)}` }));
    await user.click(screen.getByRole("menuitemradio", { name: /Moyen · 6 × 3/ }));
    expect(toolbar().textContent).toContain("1 changement");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    const saved = new Map(core.snapshot().instances.map((i) => [i.id, i.layout]));
    const draft = new Map(shown).set(first.id, layoutFor("medium", 0, 0));
    const compacted = compactLayouts(
      [...draft].map(([id, layout]) => ({ id, layout })),
      [first.id],
    );
    expect(saved).toEqual(compacted);
  });

  test("a widget moved meanwhile by another member is not moved back", async () => {
    const user = userEvent.setup();
    const core = createMockSdk({
      id: "probe",
      version: "0.1.0",
      kind: "widget",
      title: "Probe",
      reads: [],
      writes: [],
    });
    const page = Page.parse(core.run({ method: "addPage", title: "Tableau de bord", kind: "dashboard" }));
    const add = (component: string, layout: Layout) =>
      core.run({ method: "addInstance", pageId: page.id, component, layout });
    add("kanban@1.0.0", layoutFor("large", 0, 0));
    add("tickets@1.0.0", layoutFor("medium", 6, 9));
    answer = (req) => (req.method === "command" ? core.run(req.command) : null);
    const editor = (instances: Instance[]) => (
      <LayoutEditor
        projectId="p1"
        page={{ ...dashboard, id: page.id }}
        instances={instances}
        formatsFor={() => ["medium", "large", "half", "full"]}
        renderWidget={(i) => <p>{i.component}</p>}
        onClose={onClose}
      />
    );
    const view = render(editor(core.snapshot().instances));
    const ticketsId = core.snapshot().instances.find((i) => i.component === "tickets@1.0.0")?.id ?? "";
    core.run({ method: "setInstanceLayout", instanceId: ticketsId, layout: layoutFor("medium", 0, 6) });
    view.rerender(editor(core.snapshot().instances));
    await user.click(screen.getByRole("button", { name: "Format de Kanban" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Moyen · 6 × 3/ }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = new Map(core.snapshot().instances.map((i) => [i.component, i.layout]));
    expect(saved.get("kanban@1.0.0")).toEqual(layoutFor("medium", 0, 0));
    expect(saved.get("tickets@1.0.0")).toEqual(layoutFor("medium", 0, 3));
  });

  test("a refused command keeps the editor open with the error, Cancel and Escape restore", async () => {
    const user = userEvent.setup();
    answer = () => new KiboError("FORBIDDEN", "read only");
    show();
    await user.click(screen.getByRole("button", { name: "Format de Tickets" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Moyen · 6 × 3/ }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("La disposition de Tickets n'a pas été enregistrée.");
    expect(onClose).not.toHaveBeenCalled();
    expect(toolbar().textContent).toContain("1 changement");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("Escape inside the Format menu closes the menu only", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Format de Tickets" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Escape during a pointer drag cancels the drag only", async () => {
    show();
    const handle = screen.getByRole("button", { name: "Déplacer Kanban" });
    const pointer = { isPrimary: true, button: 0, pointerId: 1, clientX: 10, clientY: 10 };
    fireEvent.pointerDown(handle, pointer);
    fireEvent.pointerMove(document, { ...pointer, clientX: 60, clientY: 10 });
    fireEvent.pointerMove(document, { ...pointer, clientX: 120, clientY: 10 });
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 60));
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("removing a widget is confirmed before the command", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Retirer Tickets" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Retirer Tickets de la page ?");
    expect(calls).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Retirer" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "command",
        projectId: "p1",
        command: { method: "removeInstance", instanceId: "tickets" },
      }),
    );
  });

  test("a widget whose layout is no format takes the nearest format once moved", () => {
    const m = cellMetrics(1200);
    const step = m.column + m.gap;
    const legacy = new Map([["a", { x: 0, y: 0, w: 5, h: 5 }]]);
    const out = moveWidget(legacy, "a", { x: 2 * step, y: 0 }, m);
    expect(out).toEqual({ layouts: new Map([["a", layoutFor("medium", 2, 0)]]), placed: true });
  });

  test("moveWidget moves a widget when the target cell is free and ignores an occupied one", () => {
    const m = cellMetrics(1200);
    const step = m.column + m.gap;
    const draft = new Map([
      ["a", layoutFor("small", 0, 0)],
      ["b", layoutFor("small", 6, 0)],
    ]);
    const moved = moveWidget(draft, "a", { x: 3 * step, y: 0 }, m);
    expect(moved.placed).toBe(true);
    expect(moved.layouts.get("a")).toEqual(layoutFor("small", 3, 0));
    expect(changedIds(draft, moved.layouts)).toEqual(["a"]);
    const blocked = moveWidget(draft, "a", { x: 5 * step, y: 0 }, m);
    expect(blocked).toEqual({ layouts: draft, placed: false });
  });
});
