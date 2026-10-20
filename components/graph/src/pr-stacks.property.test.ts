import { expect, test } from "bun:test";
import { type GithubPrRef, isLivePr, type TicketView } from "@kibo/schema";
import fc from "fast-check";
import { type PrNode, prStacks, stackOrder } from "./pr-stacks";
import { prTicket, prUrl } from "./pr-stacks.test-helper";

const BRANCHES = ["dev", "main", "feat/a", "feat/b", "feat/c"] as const;
const branch = fc.option(fc.constantFrom(...BRANCHES), { nil: null });

const prArb: fc.Arbitrary<GithubPrRef> = fc
  .record({
    number: fc.integer({ min: 1, max: 30 }),
    state: fc.constantFrom("open", "draft", "merged", "closed"),
    base: branch,
    head: branch,
    review: fc.constantFrom("none", "approved", "changes_requested", "review_required"),
    checks: fc.option(fc.constantFrom("ok", "error", "running"), { nil: null }),
  })
  .map((r) => ({
    kind: "github_pr",
    url: prUrl(r.number),
    ...r,
  }));

const ticket = (n: number, refs: GithubPrRef[], parent: number | null, session: boolean): TicketView =>
  prTicket(n, {
    parentId: parent === null ? null : `t${parent}`,
    externalRefs: refs,
    progress: { done: 0, total: parent === null ? 1 : 0 },
    session: session ? { tool: "T3 Code", startedAt: 0 } : null,
  });

const ticketsArb = fc
  .array(
    fc.record({
      refs: fc.array(prArb, { maxLength: 3 }),
      parent: fc.option(fc.integer({ min: 0, max: 7 }), { nil: null }),
      session: fc.boolean(),
    }),
    { maxLength: 8 },
  )
  .map((rows) => rows.map((r, n) => ticket(n, r.refs, r.parent === n ? null : r.parent, r.session)));

const liveArb = fc
  .array(fc.integer({ min: 0, max: 7 }), { maxLength: 4 })
  .map((ns) => new Set(ns.map((n) => `t${n}`)));

const flatten = (node: PrNode): PrNode[] => [node, ...node.children.flatMap(flatten)];
const liveUrls = (tickets: readonly TicketView[]): Set<string> =>
  new Set(
    tickets.flatMap((t) =>
      t.externalRefs.flatMap((r) => (r.kind === "github_pr" && isLivePr(r) ? [r.url] : [])),
    ),
  );

test("every live PR appears exactly once and no settled PR appears", () => {
  fc.assert(
    fc.property(ticketsArb, liveArb, (tickets, live) => {
      const model = prStacks({ tickets, live });
      const ids = model.stacks.flatMap((s) => flatten(s.root)).map((n) => n.id);
      expect(ids.length).toBe(new Set(ids).size);
      expect(new Set(ids)).toEqual(liveUrls(tickets));
      expect(model.counts.open).toBe(ids.length);
      expect(model.stacks.reduce((sum, s) => sum + s.size, 0)).toBe(model.counts.open);
      expect(model.counts.stacks).toBe(model.stacks.length);
    }),
  );
});

test("stacks are sorted by stackOrder", () => {
  fc.assert(
    fc.property(ticketsArb, liveArb, (tickets, live) => {
      const { stacks } = prStacks({ tickets, live });
      expect([...stacks].sort(stackOrder)).toEqual(stacks);
    }),
  );
});

test("the model is deterministic and ignores the order of tickets", () => {
  fc.assert(
    fc.property(
      ticketsArb.chain((tickets) =>
        fc.tuple(fc.constant(tickets), fc.shuffledSubarray(tickets, { minLength: tickets.length })),
      ),
      liveArb,
      ([tickets, shuffled], live) => {
        const model = prStacks({ tickets, live });
        expect(prStacks({ tickets, live })).toEqual(model);
        expect(prStacks({ tickets: shuffled, live })).toEqual(model);
      },
    ),
  );
});

test("arbitrary cycles of bases terminate with one cut per cycle", () => {
  const cyclic = fc
    .array(fc.integer({ min: 0, max: BRANCHES.length - 1 }), { minLength: 1, maxLength: 6 })
    .map((picks) =>
      picks.map(
        (pick, i): GithubPrRef => ({
          kind: "github_pr",
          url: prUrl(i + 1),
          number: i + 1,
          state: "open",
          base: BRANCHES[pick] ?? null,
          head: BRANCHES[(pick + 1) % BRANCHES.length] ?? null,
          review: "none",
          checks: null,
        }),
      ),
    );
  fc.assert(
    fc.property(cyclic, (refs) => {
      const model = prStacks({ tickets: [ticket(1, refs, null, false)], live: new Set() });
      expect(model.counts.open).toBe(refs.length);
      expect(model.stacks.length).toBeGreaterThan(0);
    }),
  );
});
