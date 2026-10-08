import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  DEFAULT_SIZE_LIMITS,
  type Instance,
  KiboError,
  type Layout,
  layoutFor,
  Page,
  type RpcRequest,
  type SizeLimits,
} from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;

mock.module("../api", () =>
  apiMock({
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
  }),
);

const { LayoutEditor } = await import("./LayoutEditor");
const { shortcutFormats } = await import("./layout-draft");

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

const show = (
  instances = [kanban(layoutFor("large", 0, 0)), tickets(layoutFor("large", 6, 0))],
  limits: Readonly<Record<string, SizeLimits>> = {},
) =>
  render(
    <LayoutEditor
      projectId="p1"
      page={dashboard}
      instances={instances}
      formatsFor={() => ["medium", "large", "half", "full"]}
      limitsFor={(i) => limits[i.id] ?? DEFAULT_SIZE_LIMITS}
      renderWidget={(i) => <p>{i.component}</p>}
      onClose={onClose}
    />,
  );
const toolbar = () => screen.getByRole("toolbar", { name: "Disposition" });
const cellOf = (id: string): string | null => {
  const el = document.querySelector<HTMLElement>(`[data-instance="${id}"]`);
  const column = /^(\d+) \/ span (\d+)$/.exec(el?.style.gridColumn ?? "");
  const row = /^(\d+) \/ span (\d+)$/.exec(el?.style.gridRow ?? "");
  if (!column || !row) return null;
  return `${Number(column[1]) - 1},${Number(row[1]) - 1},${column[2]},${row[2]}`;
};
const press = (code: string) => fireEvent.keyDown(document.activeElement ?? document, { key: code, code });
const statusWith = (text: string) =>
  screen.getAllByRole("status").find((s) => s.textContent?.includes(text))?.textContent ?? null;
const KANBAN_LIMITS = { kanban: { min: { w: 6, h: 4 }, max: { w: 12, h: 12 } } };
const GRID_WIDTH = 1232;
const COLUMN = (GRID_WIDTH - 32 - 11 * 16) / 12;
const withGridWidth = async (run: () => Promise<void>) => {
  const owner = HTMLElement.prototype;
  const before = Object.getOwnPropertyDescriptor(owner, "clientWidth");
  Object.defineProperty(owner, "clientWidth", { configurable: true, get: () => GRID_WIDTH });
  try {
    await run();
  } finally {
    if (before) Object.defineProperty(owner, "clientWidth", before);
    else Reflect.deleteProperty(owner, "clientWidth");
  }
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const pickAndMove = async (title: string, codes: readonly string[]) => {
  screen.getByRole("button", { name: `Déplacer ${title}` }).focus();
  await act(async () => {
    press("Space");
    await tick();
  });
  for (const code of codes) await act(async () => press(code));
};

describe("layout editor", () => {
  test("screen 127/128: the format menu lists the formats, always enabled, and Save sends one setPageLayout", async () => {
    const user = userEvent.setup();
    show([kanban({ x: 0, y: 0, w: 6, h: 6 }), tickets({ x: 6, y: 0, w: 6, h: 3 })]);
    expect(toolbar().textContent).toContain("Aucun changement");
    await user.click(screen.getByRole("button", { name: "Format de Tickets" }));
    expect(screen.getByText("Raccourcis de taille")).toBeTruthy();
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual([
      "Moyen · 6 × 3",
      "Large · 6 × 6",
      "Demi-page · 12 × 6",
      "Plein écran · 12 × 9",
    ]);
    for (const item of items) expect(item.getAttribute("aria-disabled")).not.toBe("true");
    expect(screen.queryByText(/Pas de place/)).toBeNull();
    await user.click(screen.getByRole("menuitemradio", { name: /^Demi-page/ }));
    expect(cellOf("tickets")).toBe("0,0,12,6");
    expect(cellOf("kanban")).toBe("0,6,6,6");
    expect(toolbar().textContent).toContain("2 changements");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls).toEqual([
      {
        method: "command",
        projectId: "p1",
        command: {
          method: "setPageLayout",
          pageId: "pg",
          layouts: [
            { instanceId: "tickets", layout: { x: 0, y: 0, w: 12, h: 6 } },
            { instanceId: "kanban", layout: { x: 0, y: 6, w: 6, h: 6 } },
          ],
        },
      },
    ]);
  });

  test("during a drag the other widgets flow live and no drop is refused", async () => {
    show([kanban({ x: 0, y: 0, w: 6, h: 6 }), tickets({ x: 6, y: 0, w: 6, h: 3 })]);
    await pickAndMove("Tickets", [
      "ArrowLeft",
      "ArrowLeft",
      "ArrowLeft",
      "ArrowLeft",
      "ArrowLeft",
      "ArrowLeft",
    ]);
    await waitFor(() => expect(statusWith("Tickets")).toBe("Tickets : colonne 1, rangée 1."));
    expect(document.querySelector("[data-ghost]")?.getAttribute("data-ghost")).toBe("free");
    expect(cellOf("kanban")).toBe("0,3,6,6");
    await act(async () => press("Space"));
    expect(cellOf("tickets")).toBe("0,0,6,3");
    expect(cellOf("kanban")).toBe("0,3,6,6");
    expect(screen.queryByText(/la place est prise/)).toBeNull();
    expect(toolbar().textContent).toContain("2 changements");
  });

  test("shortcutFormats keeps the declared formats within the manifest size limits", () => {
    const size = { min: { w: 6, h: 4 } };
    expect(shortcutFormats({ kind: "widget", formats: ["small", "medium", "large", "half"], size })).toEqual([
      "large",
      "half",
    ]);
    expect(shortcutFormats({ kind: "widget" })).toEqual(["medium", "large", "half"]);
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
        limitsFor={() => DEFAULT_SIZE_LIMITS}
        renderWidget={(i) => <p>{i.component}</p>}
        onClose={onClose}
      />
    );
    const view = render(editor(core.snapshot().instances));
    const ticketsId = core.snapshot().instances.find((i) => i.component === "tickets@1.0.0")?.id ?? "";
    core.run({ method: "setInstanceLayout", instanceId: ticketsId, layout: layoutFor("medium", 0, 6) });
    view.rerender(editor(core.snapshot().instances));
    expect(cellOf(ticketsId)).toBe("0,6,6,3");
    await user.click(screen.getByRole("button", { name: "Format de Kanban" }));
    await user.click(screen.getByRole("menuitemradio", { name: /^Demi-page/ }));
    expect(toolbar().textContent).toContain("1 changement");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = new Map(core.snapshot().instances.map((i) => [i.component, i.layout]));
    expect(saved.get("kanban@1.0.0")).toEqual(layoutFor("half", 0, 0));
    expect(saved.get("tickets@1.0.0")).toEqual(layoutFor("medium", 0, 6));
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

  test("the corner handle resizes by cells, shows the size, and compacts the neighbours live", () =>
    withGridWidth(async () => {
      show([kanban({ x: 0, y: 0, w: 6, h: 6 }), tickets({ x: 6, y: 0, w: 6, h: 3 })], KANBAN_LIMITS);
      expect(screen.getByText("Taille · 6 × 6")).toBeTruthy();
      const handle = screen.getByRole("button", { name: "Redimensionner Kanban (coin)" });
      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 2 * (COLUMN + 16), clientY: 80 + 16, pointerId: 1 });
      expect(statusWith("cases")).toBe("8 × 7 cases");
      expect(cellOf("kanban")).toBe("0,0,8,7");
      expect(cellOf("tickets")).toBe("6,7,6,3");
      expect(screen.getByText("Taille · 8 × 7")).toBeTruthy();
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(cellOf("kanban")).toBe("0,0,8,7");
      expect(cellOf("tickets")).toBe("6,7,6,3");
      expect(toolbar().textContent).toContain("2 changements");
    }));

  test("the handle stops at the manifest minimum and Escape during a resize cancels it only", () =>
    withGridWidth(async () => {
      show([kanban({ x: 0, y: 0, w: 6, h: 6 }), tickets({ x: 6, y: 0, w: 6, h: 3 })], KANBAN_LIMITS);
      const handle = screen.getByRole("button", { name: "Redimensionner Kanban (droite)" });
      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: -3 * (COLUMN + 16), clientY: 400, pointerId: 1 });
      expect(cellOf("kanban")).toBe("0,0,6,6");
      fireEvent.pointerMove(handle, { clientX: 3 * (COLUMN + 16), clientY: 0, pointerId: 1 });
      expect(cellOf("kanban")).toBe("0,0,9,6");
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
      expect(cellOf("kanban")).toBe("0,0,6,6");
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(cellOf("kanban")).toBe("0,0,6,6");
      expect(toolbar().textContent).toContain("Aucun changement");
    }));

  test("Shift + arrows resize the focused widget within its limits", async () => {
    show([kanban({ x: 0, y: 0, w: 6, h: 6 }), tickets({ x: 6, y: 0, w: 6, h: 3 })], KANBAN_LIMITS);
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Redimensionner Kanban (droite)" }).focus();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(cellOf("kanban")).toBe("0,0,6,7");
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(cellOf("kanban")).toBe("0,0,6,7");
    expect(statusWith("cases")).toBe("Kanban : 6 × 7 cases.");
    expect(toolbar().textContent).toContain("1 changement");
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
});
