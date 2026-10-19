import { expect, test } from "bun:test";
import fc from "fast-check";
import { type HoldSource, holdsOf } from "./on-hold";

const ticketArb = (i: number) =>
  fc
    .record({
      root: fc.boolean(),
      done: fc.boolean(),
      held: fc.boolean(),
    })
    .map(
      ({ root, done, held }): HoldSource => ({
        id: `t${i}`,
        key: `SILO-${i + 1}`,
        statusId: done ? "done" : "todo",
        hold: held ? { reason: `R${i}`, since: "2026-10-16" } : null,
        parentId: root ? null : "f",
      }),
    );

const graphArb = fc.integer({ min: 1, max: 12 }).chain((n) =>
  fc.record({
    tickets: fc.tuple(...Array.from({ length: n }, (_, i) => ticketArb(i))),
    links: fc.array(
      fc.record({
        from: fc.nat(n - 1).map((i) => `t${i}`),
        to: fc.nat(n - 1).map((i) => `t${i}`),
        type: fc.constantFrom("blocks" as const, "relates" as const),
      }),
      { maxLength: 20 },
    ),
  }),
);

test("the hold of a graph with cycles terminates and only names own holds as sources", () => {
  fc.assert(
    fc.property(graphArb, ({ tickets, links }) => {
      const holds = holdsOf(tickets, links, "SILO");
      const byId = new Map(tickets.map((t) => [t.id, t]));
      const ownKeys = new Set([...holds.values()].filter((h) => h.source === "own").map((h) => h.key));
      for (const [id, hold] of holds) {
        const ticket = byId.get(id);
        expect(ticket?.parentId).not.toBeNull();
        expect(ticket?.statusId).not.toBe("done");
        if (hold.source === "dependency") expect(ownKeys.has(hold.key)).toBe(true);
        if (hold.source === "own") expect(ticket?.hold).not.toBeNull();
      }
    }),
  );
});

test("without own holds, nothing is on hold", () => {
  fc.assert(
    fc.property(graphArb, ({ tickets, links }) => {
      const free = tickets.map((t) => ({ ...t, hold: null }));
      expect(holdsOf(free, links, "SILO").size).toBe(0);
    }),
  );
});
