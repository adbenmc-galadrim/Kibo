import { beforeAll, expect, test } from "bun:test";
import {
  type GithubPrRef,
  INBOX_KEY,
  isFeature,
  openFeatures,
  type ProjectSnapshot,
  type TicketView,
} from "../../packages/schema/src/index";
import { seedEmisMaquettes } from "../seed-emis-maquettes";
import { EMIS_PROJECT, EMIS_WORKSPACE_NAME, emisKey, OTHER_PROJECTS } from "./emis-maquettes";
import { EMIS_DESCRIPTION } from "./emis-suivi";
import { createMemoryDaemon, type MemoryDaemon } from "./memory-daemon";

const VIEWER = "adam";
const TODAY = "2026-10-16";
const EVE = "2026-10-15";

let daemon: MemoryDaemon;
let today: ProjectSnapshot;

beforeAll(async () => {
  daemon = createMemoryDaemon(VIEWER, TODAY);
  await seedEmisMaquettes(daemon.rpc);
  today = daemon.snapshot(EMIS_PROJECT.key, TODAY);
});

const ticket = (s: ProjectSnapshot, n: number): TicketView => {
  const found = s.tickets.find((t) => t.key === emisKey(n));
  if (found === undefined) throw new Error(`${emisKey(n)} is missing`);
  return found;
};
const feature = (s: ProjectSnapshot, shortKey: string): TicketView => {
  const found = s.tickets.find((t) => t.shortKey === shortKey);
  if (found === undefined) throw new Error(`${shortKey} is missing`);
  return found;
};
const sprintCodeOf = (s: ProjectSnapshot, t: TicketView): string | null =>
  s.sprints.find((sp) => sp.id === t.effectiveSprintId)?.code ?? null;
type PrFacts = Pick<GithubPrRef, "number" | "state" | "review" | "checks">;
const prOf = (t: TicketView): PrFacts | null => {
  const pr = t.externalRefs.find((r): r is GithubPrRef => r.kind === "github_pr");
  return pr === undefined
    ? null
    : { number: pr.number, state: pr.state, review: pr.review, checks: pr.checks };
};

test("nine features F1 to F9 on their root tickets, in sprint order", () => {
  const features = today.tickets.filter(isFeature);
  expect(features.map((f) => `${f.shortKey}:${f.key}`)).toEqual([
    "F1:EMIS-1",
    "F2:EMIS-9",
    "F3:EMIS-17",
    "F4:EMIS-40",
    "F5:EMIS-30",
    "F6:EMIS-50",
    "F8:EMIS-70",
    "F7:EMIS-80",
    "F9:EMIS-90",
  ]);
  expect(feature(today, "F5").title).toBe("Envoyer les photos d'un tronçon");
  expect(feature(today, "F5").description).toStartWith("Sur le terrain, sans réseau");
});

test("feature states on the 16th, the last day of S42, and on the 15th", () => {
  const status = (s: ProjectSnapshot, k: string) => feature(s, k).feature?.status;
  expect(["F1", "F2", "F3"].map((k) => status(today, k))).toEqual(["delivered", "delivered", "delivered"]);
  expect(status(today, "F4")).toBe("open");
  expect(feature(today, "F4").feature?.remaining).toBe(1);
  expect(ticket(today, 46).optional).toBe(true);
  expect(ticket(today, 35).optional).toBe(false);
  expect(feature(today, "F4").progress).toEqual({ done: 3, total: 5 });
  expect(status(today, "F5")).toBe("late");
  expect(feature(today, "F5").progress).toEqual({ done: 1, total: 5 });
  expect(feature(today, "F5").feature?.remaining).toBe(4);
  expect(status(today, "F6")).toBe("blocked");
  expect(["F7", "F8", "F9"].map((k) => status(today, k))).toEqual(["todo", "todo", "todo"]);
  expect(openFeatures(today.tickets)).toBe(2);
  const eve = daemon.snapshot(EMIS_PROJECT.key, EVE);
  expect([status(eve, "F4"), status(eve, "F5")]).toEqual(["open", "open"]);
});

test("sprints S41 to S44 with their dates, states and features", () => {
  const rows = today.sprints.map((s) => [s.code, s.name, s.start, s.end, s.state, s.delivered, s.total]);
  expect(rows).toEqual([
    ["S41", "Accès", "2026-10-05", "2026-10-09", "done", 2, 2],
    ["S42", "Terrain hors ligne", "2026-10-12", "2026-10-16", "current", 1, 3],
    ["S43", "Import et soudures", "2026-10-19", "2026-10-23", "planned", 0, 2],
    ["S44", "Rapports", "2026-10-26", "2026-10-30", "planned", 0, 1],
  ]);
  const shortKeys = (name: string) =>
    today.sprints
      .find((s) => s.code === name)
      ?.features.map((id) => today.tickets.find((t) => t.id === id)?.shortKey);
  expect(shortKeys("S42")).toEqual(["F3", "F4", "F5"]);
  expect(shortKeys("S43")).toEqual(["F6", "F8"]);
  expect(feature(today, "F9").sprintId).toBeNull();
});

test("pull requests with their review and CI, branch and delivery steps", () => {
  const prs = [21, 31, 41, 42, 43, 45, 32, 61].map((n) => [emisKey(n), prOf(ticket(today, n))]);
  const pr = (
    number: number,
    state: PrFacts["state"],
    review: PrFacts["review"],
    checks: PrFacts["checks"],
  ) => ({
    number,
    state,
    review,
    checks,
  });
  const merged = (number: number) => pr(number, "merged", "approved", "ok");
  expect(prs).toEqual([
    ["EMIS-21", merged(18)],
    ["EMIS-31", merged(19)],
    ["EMIS-41", merged(12)],
    ["EMIS-42", merged(14)],
    ["EMIS-43", merged(16)],
    ["EMIS-45", pr(20, "open", "changes_requested", "error")],
    ["EMIS-32", pr(22, "open", "none", "ok")],
    ["EMIS-61", pr(23, "open", "none", "running")],
  ]);
  expect(ticket(today, 33).externalRefs).toContainEqual({
    kind: "git_branch",
    branch: "feat/envoi-hors-ligne",
    base: "dev",
  });
  const step = (n: number) => ticket(today, n).delivery?.step;
  expect([33, 45, 32, 51].map(step)).toEqual([7, 9, 10, 3]);
  const done = today.tickets.filter((t) => t.statusId === "done" && t.parentId !== null);
  expect(done.every((t) => t.delivery?.step === 11)).toBe(true);
});

test("steps wait on each other as on the mockups", () => {
  expect(ticket(today, 34).waitingOn).toEqual(["EMIS-33"]);
  expect(ticket(today, 35).waitingOn).toEqual(["EMIS-34"]);
  expect(ticket(today, 46).waitingOn).toEqual([]);
  expect(feature(today, "F9").waitingOn).toEqual(["EMIS-80"]);
  expect(today.links.filter((l) => l.type === "blocks")).toHaveLength(10);
});

test("questions Q14, Q16 and Q17 on their tickets", () => {
  const rows = today.questions.map((q) => [
    q.importRef?.id,
    today.tickets.find((t) => t.id === q.ticketId)?.key,
    q.recipient,
    q.blocking,
  ]);
  expect(rows).toEqual([
    ["Q14", "EMIS-51", "client", true],
    ["Q16", "EMIS-34", "product", false],
    ["Q17", "EMIS-81", "client", false],
  ]);
});

test("the Tickets list of S42: 14 tickets in 3 features, 8 done, one outside features in S42", () => {
  const steps = today.tickets.filter((t) => t.parentId !== null && sprintCodeOf(today, t) === "S42");
  expect(steps).toHaveLength(14);
  expect(steps.filter((t) => t.statusId === "done")).toHaveLength(8);
  expect(steps.filter((t) => t.statusId !== "done").map((t) => t.key)).toEqual([
    "EMIS-45",
    "EMIS-46",
    "EMIS-32",
    "EMIS-33",
    "EMIS-34",
    "EMIS-35",
  ]);
  const loose = today.tickets.filter((t) => t.parentId === null && t.progress.total === 0);
  expect(loose.map((t) => [t.key, t.statusId, sprintCodeOf(today, t)])).toEqual([
    ["EMIS-61", "in_review", "S42"],
    ["EMIS-62", "todo", null],
  ]);
  expect(loose.filter((t) => sprintCodeOf(today, t) === "S42")).toHaveLength(1);
});

test("delivery steps are stamped from oldest to newest of P4: 33, 45, 32 on top, then 21, 31, 43, 42 done", () => {
  const steps = today.tickets.filter((t) => t.parentId !== null && sprintCodeOf(today, t) === "S42");
  const recent = (ts: TicketView[]) =>
    [...ts]
      .sort((a, b) => (b.delivery?.at ?? -1) - (a.delivery?.at ?? -1))
      .filter((t) => t.delivery !== null)
      .map((t) => t.key);
  expect(recent(steps.filter((t) => t.statusId !== "done"))).toEqual(["EMIS-33", "EMIS-45", "EMIS-32"]);
  expect(recent(steps.filter((t) => t.statusId === "done")).slice(0, 4)).toEqual([
    "EMIS-21",
    "EMIS-31",
    "EMIS-43",
    "EMIS-42",
  ]);
});

test("sidebar counters: 6 mine, 2 in the inbox, 3 questions, 24 open tickets", () => {
  const mine = today.tickets.filter((t) => t.assignee?.ref === VIEWER && t.statusId !== "done");
  expect(mine).toHaveLength(6);
  const inbox = daemon.snapshot(INBOX_KEY, TODAY).tickets.filter((t) => t.statusId !== "done");
  expect(inbox).toHaveLength(2);
  expect(today.questions.filter((q) => q.answer === null)).toHaveLength(3);
  expect(today.tickets.filter((t) => t.statusId !== "done" && t.progress.total === 0)).toHaveLength(24);
});

test("workspace, projects, description and pages of the mockups", () => {
  expect(today.meta.description).toBe(EMIS_DESCRIPTION);
  expect(daemon.workspaceName()).toBe(EMIS_WORKSPACE_NAME);
  expect(daemon.projects().map((p) => p.name)).toEqual(["Emis", ...OTHER_PROJECTS.map((p) => p.name)]);
  expect(today.pages.map((p) => p.title)).toEqual([
    "Vue d'ensemble",
    "Planning",
    "Tickets",
    "Kanban",
    "Graphe",
    "Notes",
    "Questions",
  ]);
  const componentOf = (pageId: string) => today.instances.find((i) => i.pageId === pageId)?.component;
  expect(today.pages.map((p) => componentOf(p.id))).toEqual([
    "overview@1.0.0",
    "planning@1.0.0",
    "tickets@1.0.0",
    "kanban@1.0.0",
    "graph@1.0.0",
    "notes@1.0.0",
    "questions@1.0.0",
  ]);
});

test("seeding twice writes nothing the second time", async () => {
  const before = daemon.writes();
  await seedEmisMaquettes(daemon.rpc);
  expect(daemon.writes()).toBe(before);
});
