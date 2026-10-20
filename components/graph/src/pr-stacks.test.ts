import { expect, test } from "bun:test";
import type { FeatureState, GithubPrRef, TicketView } from "@kibo/schema";
import { frPrs } from "./fr-prs";
import { featureOf, type PrNode, type PrStack, prStacks, reviewToneOf } from "./pr-stacks";
import { prTicket, prUrl } from "./pr-stacks.test-helper";

type PrSpec = Partial<Omit<GithubPrRef, "kind" | "url">> & { number: number };

const pr = (spec: PrSpec): GithubPrRef => ({
  kind: "github_pr",
  url: prUrl(spec.number),
  state: "open",
  base: "dev",
  head: null,
  review: "none",
  checks: null,
  ...spec,
});

const FEATURE_LATE: FeatureState = {
  status: "late",
  steps: { done: 1, total: 3, mandatoryDone: 1, mandatoryTotal: 3 },
  nextStepId: null,
  remaining: 2,
  started: true,
  held: 0,
};

const withPrs = (n: number, prs: PrSpec[], over: Partial<TicketView> = {}): TicketView =>
  prTicket(n, { externalRefs: prs.map(pr), ...over });

const F5 = prTicket(30, {
  title: "Envoyer les photos d'un constat",
  shortKey: "F5",
  progress: { done: 1, total: 5 },
});
const step = (n: number, prs: PrSpec[], over: Partial<TicketView> = {}) =>
  withPrs(n, prs, { parentId: F5.id, ...over });

const model = (tickets: TicketView[], live: string[] = []) => prStacks({ tickets, live: new Set(live) });
const numbersOf = (node: PrNode): number[] => [node.number, ...node.children.flatMap(numbersOf)];
const shape = (s: PrStack): number[] => numbersOf(s.root);

test("a live PR on a step becomes a node with the ticket key, title and root feature", () => {
  const m = model([F5, step(32, [{ number: 22, head: "feat/silo-32", checks: "ok" }])]);
  const node = m.stacks[0]?.root;
  expect(node).toMatchObject({
    id: prUrl(22),
    number: 22,
    ticketId: "t32",
    key: "SILO-32",
    title: "Ticket 32",
    feature: { shortKey: "F5", title: "Envoyer les photos d'un constat" },
    review: "waiting",
    checks: "ok",
    head: "feat/silo-32",
    base: "dev",
    late: false,
    session: false,
    children: [],
  });
});

test("merged and closed PRs are left out", () => {
  const m = model([
    withPrs(1, [
      { number: 1, state: "merged" },
      { number: 2, state: "closed" },
      { number: 3, state: "draft" },
    ]),
  ]);
  expect(m.stacks.map(shape)).toEqual([[3]]);
});

test("a PR whose base is another PR's head is its child", () => {
  const m = model([
    withPrs(32, [{ number: 22, head: "feat/silo-32" }]),
    withPrs(33, [{ number: 24, base: "feat/silo-32", head: "feat/envoi" }]),
    withPrs(34, [{ number: 25, base: "feat/envoi", head: "feat/silo-34" }]),
  ]);
  expect(m.stacks.map(shape)).toEqual([[22, 24, 25]]);
  expect(m.stacks[0]?.root.children[0]?.base).toBe("feat/silo-32");
});

test("two PRs with the same head: the smallest number is the parent", () => {
  const m = model([
    withPrs(1, [{ number: 9, head: "feat/a" }]),
    withPrs(2, [{ number: 4, head: "feat/a" }]),
    withPrs(3, [{ number: 7, base: "feat/a" }]),
  ]);
  expect(m.stacks.map(shape)).toEqual([[4, 7], [9]]);
});

test("a PR without head is never a parent", () => {
  const m = model([
    withPrs(1, [{ number: 1, head: null, base: null }]),
    withPrs(2, [{ number: 2, base: null }]),
  ]);
  expect(m.stacks.map(shape)).toEqual([[1], [2]]);
});

test("a cycle of bases is cut at its smallest PR", () => {
  const m = model([
    withPrs(1, [{ number: 8, base: "feat/b", head: "feat/a" }]),
    withPrs(2, [{ number: 3, base: "feat/a", head: "feat/b" }]),
  ]);
  expect(m.stacks.map(shape)).toEqual([[3, 8]]);
});

test("children are ordered by number and stacks by size then root number", () => {
  const m = model([
    withPrs(1, [{ number: 30, head: "feat/x" }]),
    withPrs(2, [{ number: 12, base: "feat/x" }]),
    withPrs(3, [{ number: 11, base: "feat/x" }]),
    withPrs(4, [{ number: 5 }]),
    withPrs(5, [{ number: 2 }]),
  ]);
  expect(m.stacks.map(shape)).toEqual([[30, 11, 12], [2], [5]]);
});

test("the rail is the most frequent root base, ties broken alphabetically", () => {
  const frequent = model([
    withPrs(1, [{ number: 1, base: "main" }]),
    withPrs(2, [{ number: 2, base: "dev" }]),
    withPrs(3, [{ number: 3, base: "main" }]),
  ]);
  expect(frequent.rail).toBe("main");
  expect(frequent.stacks.map((s) => [s.root.number, s.onRail])).toEqual([
    [1, true],
    [2, false],
    [3, true],
  ]);
  const tie = model([withPrs(1, [{ number: 1, base: "main" }]), withPrs(2, [{ number: 2, base: "dev" }])]);
  expect(tie.rail).toBe("dev");
  expect(model([withPrs(1, [{ number: 1, base: null }])]).rail).toBeNull();
});

test("a stack knows its size, depth and number range", () => {
  const m = model([
    withPrs(1, [{ number: 22, head: "a" }]),
    withPrs(2, [{ number: 24, base: "a", head: "b" }]),
    withPrs(3, [{ number: 25, base: "b" }]),
    withPrs(4, [{ number: 20 }]),
  ]);
  expect(m.stacks.map((s) => [s.size, s.depth, s.numbers])).toEqual([
    [3, 3, { min: 22, max: 25 }],
    [1, 1, { min: 20, max: 20 }],
  ]);
});

test("counts: drafts are open but not waiting, review_required waits", () => {
  const m = model([
    withPrs(1, [
      { number: 1 },
      { number: 2, review: "review_required" },
      { number: 3, state: "draft" },
      { number: 4, review: "changes_requested" },
      { number: 5, review: "approved" },
    ]),
  ]);
  expect(m.counts).toEqual({ open: 5, stacks: 5, waiting: 2, changes: 1 });
});

test("late comes from the root feature, session from the ticket or a live run", () => {
  const late = prTicket(40, { shortKey: "F4", progress: { done: 1, total: 3 }, feature: FEATURE_LATE });
  const m = model(
    [
      late,
      withPrs(45, [{ number: 20 }], { parentId: late.id }),
      withPrs(46, [{ number: 21 }], { session: { tool: "T3 Code", startedAt: 0 } }),
      withPrs(47, [{ number: 23 }]),
    ],
    ["t47"],
  );
  expect(m.stacks.map((s) => [s.root.number, s.root.late, s.root.session])).toEqual([
    [20, true, false],
    [21, false, true],
    [23, false, true],
  ]);
});

test("a PR carried by two tickets is drawn once, on the smallest key", () => {
  const m = model([withPrs(10, [{ number: 7 }]), withPrs(9, [{ number: 7 }])]);
  expect(m.stacks.map((s) => s.root.key)).toEqual(["SILO-9"]);
  expect(m.counts.open).toBe(1);
});

test("reviewToneOf maps the review of a live PR", () => {
  expect(reviewToneOf({ state: "draft", review: "approved" })).toBe("draft");
  expect(reviewToneOf({ state: "open", review: "approved" })).toBe("approved");
  expect(reviewToneOf({ state: "open", review: "changes_requested" })).toBe("changes");
  expect(reviewToneOf({ state: "open", review: "none" })).toBe("waiting");
  expect(reviewToneOf({ state: "open", review: "review_required" })).toBe("waiting");
});

test("featureOf: a step gives its root, a root with steps itself, a free ticket null", () => {
  const free = prTicket(61);
  const s = step(32, []);
  const byId = new Map([F5, s, free].map((t) => [t.id, t]));
  const f5 = { shortKey: "F5", title: "Envoyer les photos d'un constat" };
  expect(featureOf(s, byId)).toEqual(f5);
  expect(featureOf(F5, byId)).toEqual(f5);
  expect(featureOf(free, byId)).toBeNull();
});

test("the counter uses singulars and drops empty review parts", () => {
  expect(frPrs.counter({ open: 5, stacks: 3, waiting: 2, changes: 1 })).toBe(
    "5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger",
  );
  expect(frPrs.counter({ open: 1, stacks: 1, waiting: 0, changes: 0 })).toBe("1 PR ouverte · 1 pile");
  expect(frPrs.counter({ open: 0, stacks: 0, waiting: 0, changes: 0 })).toBe("0 PR ouverte · 0 pile");
});
