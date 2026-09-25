import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen } from "@testing-library/react";
import { fr } from "./fr";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const parent = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  const child = run({ method: "createTicket", title: "Déplacement", parentId: parent.id }) as Ticket;
  run({ method: "setStatus", ticketId: child.id, statusId: "done" });
  const other = run({ method: "createTicket", title: "Sync" }) as Ticket;
  run({ method: "setStatus", ticketId: other.id, statusId: "blocked", reason: "Attente client" });
};

runConformance({ manifest, Component }, seed);

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
  fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
  expect(m.opened).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: fr.newSubTicket("KIB-1") }));
  expect(m.newTicketRequests[0]?.parentId).toBe(m.snapshot().tickets[0]?.id);
});
