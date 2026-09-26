import { expect, test } from "bun:test";
import type { ProjectCommand, ProjectSnapshot, Ticket, TicketRun } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const mine = { kind: "human", ref: "adam" } as const;
  const a = run({ method: "createTicket", title: "Arbre des pages", assignee: mine }) as Ticket;
  const b = run({ method: "createTicket", title: "Sync", assignee: mine }) as Ticket;
  run({ method: "createTicket", title: "Hors filtre", assignee: { kind: "human", ref: "lea" } });
  run({ method: "addLink", from: a.id, to: b.id, type: "blocks" });
  const agent = (ref: string) => ({ kind: "agent", ref }) as const;
  run({ method: "createTicket", title: "Récepteur", statusId: "in_progress", assignee: agent("opus-dev") });
  run({ method: "createTicket", title: "Watcher", statusId: "backlog", assignee: agent("opus-dev") });
  run({ method: "createTicket", title: "Review", statusId: "in_review", assignee: agent("sonnet-review") });
};

const runs = (s: ProjectSnapshot): TicketRun[] => {
  const id = (key: string) => s.tickets.find((t) => t.key === key)?.id ?? key;
  return [
    { ticketId: id("KIB-4"), runId: "r1", label: "opus-dev-2", state: "waiting_input", position: null },
    { ticketId: id("KIB-5"), runId: "r2", label: "opus-dev", state: "queued", position: 2 },
    { ticketId: id("KIB-6"), runId: "r3", label: "sonnet-review-1", state: "done", position: null },
  ];
};

runConformance({ manifest, Component }, seed, { runs });

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("columns follow the workflow, counter shows filtered / total, waiting badge is shown", async () => {
  setup();
  const todo = await screen.findByRole("region", { name: "À faire" });
  expect(within(todo).getByText("KIB-1")).toBeTruthy();
  expect(within(todo).getByText("À faire")).toBeTruthy();
  expect(within(todo).getByText("2")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Bloqué" })).toBeTruthy();
  expect(screen.getByText("5 / 6 tickets")).toBeTruthy();
  expect(screen.getByText("attend KIB-1")).toBeTruthy();
});

test("moving a card changes its status", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "En cours" }));
  expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")?.statusId).toBe("in_progress");
});

test("blocking asks for a reason and refuses an empty one", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Bloqué" }));
  const confirm = await screen.findByRole("button", { name: "Bloquer" });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Motif"), "Attente client");
  await user.click(confirm);
  const t = m.snapshot().tickets.find((x) => x.key === "KIB-2");
  expect(t).toMatchObject({ statusId: "blocked", blockedReason: "Attente client" });
  const blocked = screen.getByRole("region", { name: "Bloqué" });
  expect(await within(blocked).findByText("Motif : Attente client")).toBeTruthy();
});

test("the column '+' asks the host for a new ticket in that status", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nouveau ticket dans En cours" }));
  expect(m.newTicketRequests).toEqual([{ statusId: "in_progress" }]);
});

const setupFailing = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  const sdk = { ...m.sdk, run: () => Promise.reject(new Error("daemon unreachable")) };
  render(
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("a failed move shows an alert and keeps the status", async () => {
  const m = setupFailing();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "En cours" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de déplacer KIB-1.");
  expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")?.statusId).toBe("todo");
});

test("a failed block keeps the dialog open and shows an alert", async () => {
  setupFailing();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Bloqué" }));
  await user.type(await screen.findByLabelText("Motif"), "Attente client");
  await user.click(screen.getByRole("button", { name: "Bloquer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de déplacer KIB-2.");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("an agent's card shows its run: neutral badge, state dot and short state", async () => {
  const m = setup();
  m.setRuns(runs(m.snapshot()));
  const badge = async (text: string) => (await screen.findByText(text)).closest("[data-slot=badge]");
  const waiting = await badge("· Attend");
  expect(waiting?.textContent).toBe("opus-dev-2· Attend");
  expect(waiting?.querySelector("[data-state]")?.getAttribute("data-state")).toBe("waiting_input");
  expect(waiting?.className).not.toContain("brand");
  expect((await badge("· En file #2"))?.textContent).toBe("opus-dev· En file #2");
  const done = await badge("sonnet-review");
  expect(done?.querySelector("[data-state]")).toBeNull();
});
