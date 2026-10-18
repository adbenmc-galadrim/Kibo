import { expect, test } from "bun:test";
import type { ProjectCommand, RunPeek, Sprint, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Component, manifest } from "./index";

const TODAY = "2026-10-14";
const plan = (run: (cmd: ProjectCommand) => unknown, ticketId: string) => {
  const sprint = run({
    method: "createSprint",
    code: "S42",
    name: "S42",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  run({ method: "setTicketSprint", ticketId, sprintId: (sprint as Sprint).id });
};

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const root = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  plan(run, root.id);
  run({
    method: "createTicket",
    title: "Déplacement",
    parentId: root.id,
    statusId: "in_progress",
    assignee: { kind: "human", ref: "u-lea" },
    labels: ["area:web", "urgent"],
  });
  const blocked = run({ method: "createTicket", title: "Sync", parentId: root.id }) as Ticket;
  run({ method: "setStatus", ticketId: blocked.id, statusId: "blocked", reason: "Attente client" });
  run({
    method: "createTicket",
    title: "Récepteur",
    parentId: root.id,
    statusId: "in_progress",
    assignee: { kind: "agent", ref: "opus-dev" },
  });
  run({ method: "createTicket", title: "Lecture", parentId: root.id });
};

const PEEK: RunPeek = {
  runId: "r1",
  label: "opus-dev-2",
  profileName: "opus-dev",
  state: "running",
  ticketKey: "KIB-4",
  ticketTitle: "Récepteur",
  step: { index: 1, total: 3, title: "Lire les hooks" },
  lastMessage: null,
  waiting: false,
};

const setup = () => {
  const m = createMockSdk(manifest, {
    seed,
    today: TODAY,
    shared: true,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
    peeks: { r1: PEEK },
    agentExecution: "shown",
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const details = async (title: string) => {
  fireEvent.focus(await screen.findByRole("button", { name: title }));
  const card = await waitFor(() => {
    const found = document.querySelector("[data-slot=hover-card-content]");
    if (!(found instanceof HTMLElement)) throw new Error("no hover card");
    return found;
  });
  return within(card);
};

test("the row is unchanged; the hover card of its title shows assignee and labels", async () => {
  setup();
  await screen.findByText("Déplacement");
  expect(screen.queryByText("Léa")).toBeNull();
  expect(screen.queryByText("urgent")).toBeNull();
  expect(screen.queryByText("Attente client")).toBeNull();
  const card = await details("Déplacement");
  expect(card.getByText("Assigné : Léa")).toBeTruthy();
  expect(card.getByText("area:web")).toBeTruthy();
  expect(card.getByText("urgent")).toBeTruthy();
});

test("a blocked step gives its reason in its hover card", async () => {
  setup();
  expect((await details("Sync")).getByText("Bloqué : Attente client")).toBeTruthy();
});

test("a startable step says so in its hover card", async () => {
  setup();
  expect((await details("Lecture")).getByText("Démarrable")).toBeTruthy();
});

test("an agent step carries its agent chip: a live run is a mention that peeks and opens the run", async () => {
  const m = setup();
  await screen.findByText("Récepteur");
  const id = m.snapshot().tickets.find((t) => t.title === "Récepteur")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-2", state: "running", position: null }]),
  );
  const card = await details("Récepteur");
  const mention = await card.findByRole("button", { name: "opus-dev-2" });
  fireEvent.pointerEnter(mention);
  expect(await screen.findByText("1/3 · Lire les hooks")).toBeTruthy();
  fireEvent.click(mention);
  expect(m.openedRuns).toEqual(["r1"]);
});
