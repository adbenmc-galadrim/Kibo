import { afterAll, expect, test } from "bun:test";
import { SIGNALS_PER_RUN_MAX } from "@kibo/schema";
import fc from "fast-check";
import { signalSetup } from "./service.test-helper";

const s = signalSetup();
afterAll(() => s.close());

const KINDS = ["ticket", "context", "blocker", "question"] as const;
const title = fc.oneof(
  fc.constantFrom("Tests", "Ordre", "Port ?", "x".repeat(201), "", "  "),
  fc.nat({ max: 40 }).map((n) => `Spam ${n}`),
);
const ticket = fc.constantFrom(undefined, "EMIS-1", "EMIS-2", "EMIS-99", "emis-1");
const input = fc.oneof(
  fc.record({ kind: fc.constantFrom(...KINDS), title, body: fc.string({ maxLength: 40 }), ticket }),
  fc.record({ kind: fc.constantFrom("idea", 3), title }),
  fc.anything(),
);

let runs = 0;

test("no sequence of signals ever runs a project command nor changes the tickets", async () => {
  const projectId = s.h.project.id;
  const tickets = () => s.h.data.project(projectId).tickets.length;
  const before = tickets();
  await fc.assert(
    fc.asyncProperty(fc.array(input, { maxLength: 60 }), fc.boolean(), async (inputs, asProject) => {
      const run = s.ticketRun({ id: `r${++runs}`, kind: asProject ? "project" : "ticket" });
      for (const raw of inputs) await s.service.record(run, raw).catch(() => null);
      expect(s.h.commands).toEqual([]);
      expect(tickets()).toBe(before);
      expect(s.store.countByRun(run.id)).toBeLessThanOrEqual(asProject ? 0 : SIGNALS_PER_RUN_MAX);
    }),
    { numRuns: 60 },
  );
});
