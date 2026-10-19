import { expect, test } from "bun:test";
import { siloHeldProject } from "../shell/feature/fixture";
import { journalSignal } from "./use-ticket-tracking";

test("putting a step on hold or resuming it reloads its journal", () => {
  const step = siloHeldProject().tickets.find((t) => t.id === "e33");
  if (!step) throw new Error("fixture without SILO-33");
  expect(journalSignal(step)).not.toBe(journalSignal({ ...step, hold: null }));
});
