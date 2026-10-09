import { expect, test } from "bun:test";
import {
  type ComponentFormat,
  type ProjectCommand,
  type ProjectSnapshot,
  Ticket,
  type TicketRun,
} from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

const runs = (s: ProjectSnapshot): TicketRun[] => {
  const id = (key: string) => s.tickets.find((t) => t.key === key)?.id ?? key;
  return [
    { ticketId: id("KIB-12"), runId: "r1", label: "opus-dev-1", state: "running", position: null },
    { ticketId: id("KIB-14"), runId: "r2", label: "opus-dev-2", state: "waiting_input", position: null },
    { ticketId: id("KIB-18"), runId: "r3", label: "opus-dev", state: "queued", position: 1 },
    { ticketId: id("KIB-16"), runId: "r4", label: "opus-dev-3", state: "done", position: null },
  ];
};

runConformance({ manifest, Component }, seed, { runs });

const setup = (surface: "view" | "widget", seedFn: typeof seed | null = seed, format?: ComponentFormat) => {
  const m = createMockSdk(manifest, {
    ...(seedFn && { seed: seedFn }),
    ...(format && { format }),
    surface,
    viewer: "adam",
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("screen 10: nodes, critical path summary, legend and zoom", async () => {
  const m = setup("view");
  expect(await screen.findByText("Chemin critique : 3 tickets · 1 bloqué")).toBeTruthy();
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const node = within(canvas).getByRole("button", { name: /KIB-21 Sandbox iframe des composants/ });
  expect(node.getAttribute("data-critical")).toBe("true");
  expect(
    within(canvas)
      .getByRole("button", { name: /KIB-12/ })
      .getAttribute("data-critical"),
  ).toBe("false");
  expect(within(canvas).getByRole("button", { name: /KIB-5 / }).className).toContain("opacity-45");
  expect(screen.getByText("Lié à")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(node);
  expect(node.getAttribute("data-selected")).toBe("true");
  expect(m.opened).toEqual([]);
  await user.click(within(canvas).getByRole("button", { name: "Ouvrir KIB-21" }));
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-21")?.id ?? ""]);
});

test("keyboard: arrows walk the neighbors, Enter opens, Escape clears; shift-drag selects a box", async () => {
  const m = setup("view");
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const user = userEvent.setup();
  await user.click(within(canvas).getByRole("button", { name: /KIB-11 / }));
  canvas.focus();
  await user.keyboard("{ArrowRight}");
  expect(
    within(canvas)
      .getByRole("button", { name: /KIB-21 / })
      .getAttribute("data-selected"),
  ).toBe("true");
  await user.keyboard("{Enter}");
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-21")?.id ?? ""]);
  await user.keyboard("{Escape}");
  expect(canvas.querySelectorAll("[data-selected='true']")).toHaveLength(0);
  // happy-dom implements no pointer capture
  Object.assign(canvas, { setPointerCapture: () => undefined });
  fireEvent.pointerDown(canvas, { shiftKey: true, clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(canvas, { shiftKey: true, clientX: 5000, clientY: 5000, pointerId: 1 });
  fireEvent.pointerUp(canvas, { pointerId: 1 });
  expect(canvas.querySelectorAll("[data-selected='true']").length).toBeGreaterThan(2);
  expect(screen.getByRole("status").textContent).toMatch(/sélectionnés$/);
});

test("toolbar: hide done, critical path toggle, zoom", async () => {
  setup("view");
  const user = userEvent.setup();
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  expect(screen.getByRole("button", { name: "Hiérarchique" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Masquer terminés" }));
  expect(screen.queryByRole("button", { name: /KIB-5 / })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Chemin critique" }));
  expect(screen.getByRole("button", { name: /KIB-21/ }).getAttribute("data-critical")).toBe("false");
  await user.click(screen.getByRole("button", { name: "Zoom avant" }));
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("110 %");
  await user.click(screen.getByRole("button", { name: "Taille réelle" }));
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("100 %");
});

// happy-dom WheelEvent carries neither modifier keys nor pointer coordinates
const pinch = (el: Element, deltaY: number, at: { x: number; y: number }) => {
  const event = createEvent.wheel(el, { deltaY });
  Object.defineProperties(event, {
    ctrlKey: { value: true },
    clientX: { value: at.x },
    clientY: { value: at.y },
  });
  fireEvent(el, event);
};

test("pinch zooms around the pointer, two fingers pan, double click frames a node, Tout voir fits", async () => {
  setup("view");
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const stage = () => canvas.querySelector<HTMLElement>("[data-stage]");
  const before = stage()?.style.transform ?? "";
  fireEvent.wheel(canvas, { deltaX: 30, deltaY: 20 });
  expect(stage()?.style.transform).not.toBe(before);
  pinch(canvas, -100, { x: 10, y: 10 });
  expect(canvas.getAttribute("data-zoom")).toBe("2.72");
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("272 %");
  await userEvent.setup().dblClick(within(canvas).getByRole("button", { name: /KIB-21 / }));
  expect(canvas.getAttribute("data-zoom")).toBe("1.25");
  await userEvent.setup().click(screen.getByRole("button", { name: "Tout voir" }));
  expect(canvas.getAttribute("data-zoom")).toBe("1");
  expect(screen.getByRole("img", { name: "Vue d'ensemble du graphe" })).toBeTruthy();
});

test("screen 7 widget (medium): chain, waiting list with blocked reason, link to the view", async () => {
  const m = setup("widget", seed, "medium");
  expect(await screen.findByText("Chemin critique · 3 tickets")).toBeTruthy();
  const chain = screen.getByRole("list", { name: "Chemin critique" });
  expect(
    within(chain)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
  const waiting = screen.getByRole("list", { name: "En attente" });
  expect(within(waiting).getByText(/^KIB-21 · bloqué : Audit sécurité externe en attente/)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le graphe →" }));
  expect(m.openedViews).toEqual(["graph"]);
});

test("small: three counters; medium: chain and waiting list; large: framed graph; full: the page", async () => {
  setup("widget", seed, "small");
  expect(await screen.findByText("Bloqués")).toBeTruthy();
  expect(screen.getByText("Prêts")).toBeTruthy();
  expect(screen.getByText("Chemin critique")).toBeTruthy();
  expect(screen.getByRole("group", { name: "Bloqués" }).textContent).toMatch(/\d/);
  cleanup();

  const medium = setup("widget", seed, "medium");
  expect(await screen.findByRole("list", { name: "Chemin critique" })).toBeTruthy();
  const waiting = screen.getByRole("list", { name: "En attente" });
  expect(within(waiting).getAllByRole("listitem")[0]?.textContent).toMatch(/^KIB-\d+ · attend KIB-\d+/);
  await userEvent.setup().click(within(waiting).getAllByRole("button")[0] ?? document.body);
  expect(medium.opened).toHaveLength(1);
  cleanup();

  setup("widget", seed, "large");
  expect(await screen.findByRole("region", { name: "Graphe des dépendances" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tout voir" })).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Vue d'ensemble du graphe" })).toBeNull();
  cleanup();

  setup("widget", seed, "full");
  expect(await screen.findByRole("button", { name: "Masquer terminés" })).toBeTruthy();
});

test("small counts blocked and ready tickets of the widget's tickets", async () => {
  setup("widget", seed, "small");
  const count = async (name: string) =>
    (await screen.findByRole("group", { name })).querySelector("dd")?.textContent;
  expect(await count("Chemin critique")).toBe("3");
  expect(Number(await count("Bloqués"))).toBeGreaterThan(0);
  expect(Number(await count("Prêts"))).toBeGreaterThan(0);
});

const seedLinked = (run: (cmd: ProjectCommand) => unknown) => {
  const create = (title: string) =>
    Ticket.parse(
      run({ method: "createTicket", title, parentId: null, assignee: { kind: "human", ref: "adam" } }),
    ).id;
  run({ method: "addLink", from: create("Amont"), to: create("Aval"), type: "blocks" });
};

test("§22.1: the isolated block is labelled, and only when there is one", async () => {
  setup("view", seed, "full");
  expect(await screen.findByText("Sans dépendance")).toBeTruthy();
  cleanup();
  setup("view", seedLinked, "full");
  await screen.findByRole("button", { name: /Amont/ });
  expect(screen.queryByText("Sans dépendance")).toBeNull();
});

test("D9: empty states", async () => {
  setup("view", null);
  expect(await screen.findByText("Aucune dépendance entre les tickets affichés.")).toBeTruthy();
});

test("D9: empty widget", async () => {
  setup("widget", null, "medium");
  expect(await screen.findByText("Aucun chemin critique : aucun ticket bloquant.")).toBeTruthy();
});

test("screen 10: an agent's node shows its live run state dot", async () => {
  const m = setup("view");
  m.setRuns(runs(m.snapshot()));
  const canvas = await screen.findByRole("region", { name: "Graphe des dépendances" });
  const dot = (key: string) =>
    within(canvas)
      .getByRole("button", { name: new RegExp(`${key} `) })
      .querySelector("[data-state]")
      ?.getAttribute("data-state");
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  await waitFor(() => expect(dot("KIB-14")).toBe("waiting_input"));
  expect(dot("KIB-18")).toBe("queued");
  expect(dot("KIB-12")).toBe("running");
  expect(dot("KIB-16")).toBeUndefined();
  expect(dot("KIB-21")).toBeUndefined();
});

test("shared selection: a click emits it, an outside selection is followed, Escape clears it", async () => {
  const m = setup("view");
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const idOf = (key: string) => m.snapshot().tickets.find((t) => t.key === key)?.id ?? "";
  const node = (key: string) => within(canvas).getByRole("button", { name: new RegExp(`${key} `) });
  const user = userEvent.setup();
  await user.click(node("KIB-21"));
  expect(m.selections.at(-1)).toEqual({ kind: "ticket", ids: [idOf("KIB-21")] });
  act(() => m.setSelection({ kind: "ticket", ids: [idOf("KIB-12")] }));
  expect(node("KIB-12").getAttribute("data-selected")).toBe("true");
  expect(node("KIB-12").getAttribute("aria-pressed")).toBe("true");
  expect(node("KIB-21").getAttribute("data-selected")).toBe("false");
  canvas.focus();
  await user.keyboard("{Escape}");
  expect(m.selections.at(-1)).toBeNull();
  expect(canvas.querySelectorAll("[data-selected='true']")).toHaveLength(0);
});

test("shared selection: an echo of its own selection keeps the keyboard anchor", async () => {
  const m = setup("view");
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const idOf = (key: string) => m.snapshot().tickets.find((t) => t.key === key)?.id ?? "";
  const user = userEvent.setup();
  await user.click(within(canvas).getByRole("button", { name: /KIB-11 / }));
  act(() => m.setSelection({ kind: "ticket", ids: [idOf("KIB-11")] }));
  canvas.focus();
  await user.keyboard("{ArrowRight}");
  expect(m.selections.at(-1)).toEqual({ kind: "ticket", ids: [idOf("KIB-21")] });
  act(() => m.setSelection({ kind: "ticket", ids: [idOf("KIB-12")] }));
  await user.keyboard("{Enter}");
  expect(m.opened).toEqual([idOf("KIB-12")]);
});

test("unassigned dependencies: hidden by « Moi + agents », drawn with the « all » filter", async () => {
  const unassigned = (run: (cmd: ProjectCommand) => unknown) => {
    const create = (title: string) => Ticket.parse(run({ method: "createTicket", title })).id;
    run({ method: "addLink", from: create("Amont"), to: create("Aval"), type: "blocks" });
  };
  const mount = (config: Record<string, unknown>) =>
    render(
      <SdkProvider
        sdk={createMockSdk(manifest, { seed: unassigned, surface: "view", viewer: "adam", config }).sdk}
      >
        <Component />
      </SdkProvider>,
    );
  mount({});
  expect(await screen.findByText("Aucune dépendance entre les tickets affichés.")).toBeTruthy();
  cleanup();
  mount({ filter: "all" });
  expect(await screen.findByRole("button", { name: /Amont/ })).toBeTruthy();
});

test("minimap: never selectable, press and drag only move the view", async () => {
  setup("view");
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  const canvas = screen.getByRole("region", { name: "Graphe des dépendances" });
  const minimap = screen.getByRole("img", { name: "Vue d'ensemble du graphe" });
  expect(canvas.classList.contains("select-none")).toBe(true);
  expect(minimap.classList.contains("select-none")).toBe(true);
  const stage = () => canvas.querySelector<HTMLElement>("[data-stage]")?.style.transform ?? "";
  expect(fireEvent.pointerDown(minimap, { clientX: 10, clientY: 10, pointerId: 1 })).toBe(false);
  const pressed = stage();
  fireEvent.pointerMove(minimap, { clientX: 60, clientY: 50, pointerId: 1 });
  const dragged = stage();
  expect(dragged).not.toBe(pressed);
  fireEvent.pointerUp(minimap, { pointerId: 1 });
  fireEvent.pointerMove(minimap, { clientX: 120, clientY: 90, pointerId: 1 });
  expect(stage()).toBe(dragged);
  fireEvent.pointerDown(minimap, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerLeave(minimap, { pointerId: 1 });
  const left = stage();
  fireEvent.pointerMove(minimap, { clientX: 90, clientY: 70, pointerId: 1 });
  expect(stage()).toBe(left);
});
