import { afterEach, expect, test } from "bun:test";
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
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { seedSprintGraph } from "./graph-sprints-seed";
import { Component, manifest } from "./index";

afterEach(cleanup);

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

const runs = (s: ProjectSnapshot): TicketRun[] => {
  const id = (key: string) => s.tickets.find((t) => t.key === key)?.id ?? key;
  return [
    { ticketId: id("KIB-29"), runId: "r1", label: "opus-dev-1", state: "running", position: null },
    { ticketId: id("KIB-14"), runId: "r2", label: "opus-dev-2", state: "waiting_input", position: null },
  ];
};

runConformance({ manifest, Component }, seed, { runs });

type Seed = (run: (cmd: ProjectCommand) => unknown) => void;

const setup = (format: ComponentFormat, seedFn: Seed | null = seed, config: Record<string, unknown> = {}) => {
  const m = createMockSdk(manifest, {
    ...(seedFn && { seed: seedFn }),
    format,
    surface: "widget",
    viewer: "adam",
    agentExecution: "shown",
    config,
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const count = async (name: string) =>
  (await screen.findByRole("group", { name })).querySelector("dd")?.textContent;

test("small: three counters of the widget's tickets", async () => {
  setup("small");
  expect(await count("Chemin critique")).toBe("3");
  expect(Number(await count("Bloqués"))).toBeGreaterThan(0);
  expect(Number(await count("Prêts"))).toBeGreaterThan(0);
  expect(screen.queryByRole("region", { name: "Fonctionnalités par sprint" })).toBeNull();
  expect(screen.queryByRole("radiogroup", { name: "Vue" })).toBeNull();
});

test("medium: the chain, the waiting list with the blocked reason, and the link to the view", async () => {
  const m = setup("medium");
  expect(await screen.findByText("Chemin critique · 3 tickets")).toBeTruthy();
  const chain = screen.getByRole("list", { name: "Chemin critique" });
  expect(
    within(chain)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
  const waiting = screen.getByRole("list", { name: "En attente" });
  expect(within(waiting).getByText(/^KIB-21 · bloqué : Audit sécurité externe en attente/)).toBeTruthy();
  expect(within(waiting).getAllByRole("listitem")[0]?.textContent).toMatch(/^KIB-\d+ · attend KIB-\d+/);
  const user = userEvent.setup();
  await user.click(within(waiting).getAllByRole("button")[0] ?? document.body);
  expect(m.opened).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Ouvrir le graphe →" }));
  expect(m.openedViews).toEqual(["graph"]);
});

for (const format of ["large", "half", "full"] as const) {
  test(`${format}: the whole page, columns included`, async () => {
    setup(format, seedSprintGraph);
    expect(await screen.findByRole("region", { name: "Fonctionnalités par sprint" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Vue" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "En attente" })).toBeNull();
  });
}

test("an empty widget says there is no critical path", async () => {
  setup("medium", null);
  expect(await screen.findByText("Aucun chemin critique : aucun ticket bloquant.")).toBeTruthy();
});

const unassigned: Seed = (run) => {
  const create = (title: string) => Ticket.parse(run({ method: "createTicket", title })).id;
  run({ method: "addLink", from: create("Amont"), to: create("Aval"), type: "blocks" });
};

test("« Moi + agents » leaves unassigned tickets out, config.filter « all » brings them in", async () => {
  setup("medium", unassigned);
  expect(await screen.findByText("Aucun chemin critique : aucun ticket bloquant.")).toBeTruthy();
  cleanup();
  setup("medium", unassigned, { filter: "all" });
  expect(await screen.findByText("Chemin critique · 2 tickets")).toBeTruthy();
});
