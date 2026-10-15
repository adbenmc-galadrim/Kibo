import { expect, test } from "bun:test";
import fc from "fast-check";
import { type DeliveryOrderTicket, deliveryOrder } from "./delivery-order";

const PARENT = "p";

const leaf = (i: number, rank: number): DeliveryOrderTicket => ({
  id: `t${i}`,
  key: `EMIS-${i + 1}`,
  title: `T${i}`,
  parentId: PARENT,
  statusId: "todo",
  startable: true,
  rank,
  openBlockingQuestions: 0,
});

const setup = fc.integer({ min: 1, max: 12 }).chain((n) =>
  fc.record({
    ranks: fc.shuffledSubarray(
      Array.from({ length: n }, (_, i) => i),
      { minLength: n, maxLength: n },
    ),
    edges: fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 3 * n }),
  }),
);

const ticketsOf = (ranks: number[]): DeliveryOrderTicket[] => [
  { ...leaf(-1, -1), id: PARENT, parentId: null },
  ...ranks.map((rank, i) => leaf(i, rank)),
];

test("every leaf appears once and a blocker always precedes what it blocks", () => {
  fc.assert(
    fc.property(setup, ({ ranks, edges }) => {
      const links = edges
        .filter(([a, b]) => a < b)
        .map(([a, b]) => ({ from: `t${a}`, to: `t${b}`, type: "blocks" as const }));
      const items = deliveryOrder({ tickets: ticketsOf(ranks), links, busy: new Set(), parentId: PARENT });
      const order = items.map((i) => i.ticketId);
      expect([...order].sort()).toEqual(ranks.map((_, i) => `t${i}`).sort());
      for (const l of links) expect(order.indexOf(l.from)).toBeLessThan(order.indexOf(l.to));
    }),
    { numRuns: 300 },
  );
});

test("cycles end without a loop and keep every leaf", () => {
  fc.assert(
    fc.property(setup, ({ ranks, edges }) => {
      const links = edges.map(([a, b]) => ({ from: `t${a}`, to: `t${b}`, type: "blocks" as const }));
      const items = deliveryOrder({ tickets: ticketsOf(ranks), links, busy: new Set(), parentId: PARENT });
      expect(items).toHaveLength(ranks.length);
      expect(new Set(items.map((i) => i.ticketId)).size).toBe(ranks.length);
    }),
    { numRuns: 300 },
  );
});
