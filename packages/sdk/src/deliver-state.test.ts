import { expect, test } from "bun:test";
import { type DeliverInput, deliverEntry } from "./deliver-state";

const input = (patch: Partial<DeliverInput> = {}): DeliverInput => ({
  ticket: { key: "EMIS-15", statusId: "todo", startable: true, waitingOn: [] },
  editable: true,
  agentKnown: true,
  parent: false,
  run: null,
  ...patch,
});

test("an editor can deliver a keyed, unfinished ticket when a delivery agent is known", () => {
  expect(deliverEntry(input())).toEqual({ disabledReason: null });
});

test("Livrer is absent for a reader, a done ticket, a ticket without key or without agent", () => {
  expect(deliverEntry(input({ editable: false }))).toBeNull();
  expect(deliverEntry(input({ agentKnown: false }))).toBeNull();
  const ticket = input().ticket;
  expect(deliverEntry(input({ ticket: { ...ticket, statusId: "done" } }))).toBeNull();
  expect(deliverEntry(input({ ticket: { ...ticket, key: null } }))).toBeNull();
});

test("an active run disables Livrer and names the run", () => {
  const run = { label: "emis · full-delivery · EMIS-15", state: "running" } as const;
  expect(deliverEntry(input({ run }))).toEqual({
    disabledReason: "déjà un run : emis · full-delivery · EMIS-15",
  });
  expect(deliverEntry(input({ run: { ...run, state: "done" } }))).toEqual({ disabledReason: null });
});

test("a ticket that cannot start says why", () => {
  const ticket: DeliverInput["ticket"] = {
    key: "EMIS-22",
    statusId: "todo",
    startable: false,
    waitingOn: ["EMIS-21"],
  };
  expect(deliverEntry(input({ ticket }))).toEqual({ disabledReason: "bloqué par EMIS-21" });
  expect(deliverEntry(input({ ticket: { ...ticket, waitingOn: [] } }))).toEqual({
    disabledReason: "question bloquante",
  });
});

test("a parent or a ticket already in progress stays deliverable", () => {
  const ticket: DeliverInput["ticket"] = {
    key: "EMIS-17",
    statusId: "todo",
    startable: false,
    waitingOn: ["EMIS-9"],
  };
  expect(deliverEntry(input({ ticket, parent: true }))).toEqual({ disabledReason: null });
  const started: DeliverInput["ticket"] = { ...ticket, statusId: "in_progress" };
  expect(deliverEntry(input({ ticket: started }))).toEqual({ disabledReason: null });
});
