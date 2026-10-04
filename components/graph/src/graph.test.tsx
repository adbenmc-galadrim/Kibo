import { expect, test } from "bun:test";
import type { ProjectCommand, ProjectSnapshot, TicketRun } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const setup = (surface: "view" | "widget", seedFn: typeof seed | null = seed) => {
  const m = createMockSdk(manifest, { ...(seedFn && { seed: seedFn }), surface, viewer: "adam" });
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
  await userEvent.setup().click(node);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-21")?.id ?? ""]);
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

test("screen 7 widget: chain, blocked reason and a link to the view", async () => {
  const m = setup("widget");
  expect(await screen.findByText("Chemin critique · 3 tickets")).toBeTruthy();
  const chain = screen.getByRole("list", { name: "Chemin critique" });
  expect(
    within(chain)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
  expect(screen.getByText("KIB-21 bloqué : audit sécurité externe en attente")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le graphe →" }));
  expect(m.openedViews).toEqual(["graph"]);
});

test("D9: empty states", async () => {
  setup("view", null);
  expect(await screen.findByText("Aucune dépendance entre les tickets affichés.")).toBeTruthy();
});

test("D9: empty widget", async () => {
  setup("widget", null);
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
