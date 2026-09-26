import { expect, test } from "bun:test";
import type { ProjectCommand, ProjectSnapshot, Ticket, TicketRun } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { fr } from "./fr";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const parent = run({
    method: "createTicket",
    title: "Arbre des pages",
    assignee: { kind: "human", ref: "adam" },
  }) as Ticket;
  const child = run({ method: "createTicket", title: "Déplacement", parentId: parent.id }) as Ticket;
  run({ method: "setStatus", ticketId: child.id, statusId: "done" });
  const other = run({
    method: "createTicket",
    title: "Sync",
    assignee: { kind: "agent", ref: "opus-dev" },
  }) as Ticket;
  run({ method: "setStatus", ticketId: other.id, statusId: "blocked", reason: "Attente client" });
};

const runs = (s: ProjectSnapshot): TicketRun[] => [
  {
    ticketId: s.tickets.find((t) => t.title === "Sync")?.id ?? "",
    runId: "r1",
    label: "opus-dev-2",
    state: "waiting_input",
    position: null,
  },
];

runConformance({ manifest, Component }, seed, runs);

test("shows keys, progress, blocked reason and opens a ticket", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("KIB-1")).toBeTruthy();
  expect(screen.getByText("1/1")).toBeTruthy();
  expect(screen.getByText("Attente client")).toBeTruthy();
  for (const header of ["Ticket", "Statut", "Assigné", "Sous-tickets"])
    expect(screen.getByText(header)).toBeTruthy();
  expect(screen.getByText("Terminé")).toBeTruthy();
  expect(screen.getByText("Bloqué")).toBeTruthy();
  expect(screen.getAllByText("À faire")).toHaveLength(1);
  expect(screen.getByText("adam")).toBeTruthy();
  expect(screen.getByText("opus-dev")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
  expect(m.opened).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: fr.newSubTicket("KIB-1") }));
  expect(m.newTicketRequests[0]?.parentId).toBe(m.snapshot().tickets[0]?.id);
});

test("an agent assignee shows the state of its run", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("opus-dev")).toBeTruthy();
  act(() => m.setRuns(runs(m.snapshot())));
  const badge = (await screen.findByText("· Attend")).closest("[data-slot=badge]");
  expect(badge?.textContent).toBe("opus-dev-2· Attend");
  expect(badge?.querySelector("[data-state]")?.getAttribute("data-state")).toBe("waiting_input");
});
