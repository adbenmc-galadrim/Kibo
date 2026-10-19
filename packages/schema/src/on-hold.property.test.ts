import { expect, test } from "bun:test";
import fc from "fast-check";
import { type HoldSource, holdsOf } from "./on-hold";

const odds = (tenths: number) => fc.integer({ min: 0, max: 9 }).map((n) => n < tenths);
const EVEN = { root: 5, done: 5, held: 5 };
const DENSE = { root: 1, done: 1, held: 4 };

const ticketArb = (i: number, bias = EVEN) =>
  fc
    .record({
      root: odds(bias.root),
      done: odds(bias.done),
      held: odds(bias.held),
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

const graphOf = (bias: typeof EVEN) =>
  fc.integer({ min: 1, max: 12 }).chain((n) =>
    fc.record({
      tickets: fc.tuple(...Array.from({ length: n }, (_, i) => ticketArb(i, bias))),
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
const graphArb = graphOf(EVEN);
const denseGraphArb = graphOf(DENSE);

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

const keyNumber = (key: string): number => Number(key.slice(key.indexOf("-") + 1));

function reachedFrom(tickets: readonly HoldSource[], links: readonly HoldLinkInput[]): Map<string, string[]> {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const waits = (t: HoldSource | undefined): t is HoldSource =>
    t !== undefined && t.parentId !== null && t.statusId !== "done";
  const sources = new Map<string, string[]>();
  for (const source of tickets.filter((t) => waits(t) && t.hold !== null)) {
    const reached = new Set([source.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of links) {
        if (l.type !== "blocks" || !reached.has(l.from) || reached.has(l.to) || !waits(byId.get(l.to)))
          continue;
        reached.add(l.to);
        grew = true;
      }
    }
    for (const id of reached)
      if (id !== source.id) sources.set(id, [...(sources.get(id) ?? []), source.key ?? ""]);
  }
  return sources;
}
type HoldLinkInput = { from: string; to: string; type: "blocks" | "relates" };

test("a step waits exactly when an own hold reaches it, for the smallest key among them", () => {
  fc.assert(
    fc.property(denseGraphArb, ({ tickets, links }) => {
      const holds = holdsOf(tickets, links, "SILO");
      const reached = reachedFrom(tickets, links);
      const own = new Set(
        tickets
          .filter((t) => t.hold !== null && t.parentId !== null && t.statusId !== "done")
          .map((t) => t.id),
      );
      const expected = new Set([...own, ...reached.keys()]);
      expect(new Set(holds.keys())).toEqual(expected);
      for (const [id, hold] of holds) {
        if (hold.source !== "dependency") continue;
        const sources = reached.get(id) ?? [];
        expect(sources).toContain(hold.key);
        expect(keyNumber(hold.key)).toBe(Math.min(...sources.map(keyNumber)));
      }
    }),
    { numRuns: 500 },
  );
});
