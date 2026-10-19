import { expect, test } from "bun:test";
import { type DeliveryStep, KiboError } from "@kibo/schema";
import { fakeAgentsPort } from "../agents-port.test-helper";
import { ticketRun } from "../overlaps/peek-fakes.test-helper";
import { withDeliverySteps } from "./run-steps";

const STEP: DeliveryStep = { step: 7, note: "porte qualité", at: 1, runId: "r1", kind: "delivery" };

test("an active run shows the delivery step of its ticket, an ended run or a ticket without step shows none", () => {
  const active = ticketRun("r1", "SILO-15");
  const plain = ticketRun("r2", "SILO-16");
  const ended = ticketRun("r3", "SILO-17", { state: "done" });
  const steps = new Map([
    [active.ticketId, STEP],
    [ended.ticketId, STEP],
  ]);
  const port = withDeliverySteps(
    fakeAgentsPort([active, plain, ended]),
    (_projectId, ticketId) => steps.get(ticketId) ?? null,
  );
  expect(port.state().delivery).toEqual([{ runId: "r1", step: 7, note: "porte qualité" }]);
});

test("a ticket removed under its run is skipped, any other failure is not hidden", () => {
  const run = ticketRun("r1", "SILO-15");
  const removed = withDeliverySteps(fakeAgentsPort([run]), () => {
    throw new KiboError("NOT_FOUND", "ticket gone");
  });
  expect(removed.state().delivery).toEqual([]);
  const broken = withDeliverySteps(fakeAgentsPort([run]), () => {
    throw new KiboError("STORE_CORRUPT", "invalid delivery step");
  });
  expect(() => broken.state()).toThrow("invalid delivery step");
});
