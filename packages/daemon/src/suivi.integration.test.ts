import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import type { Batch, Sprint } from "@kibo/schema";
import { cleanSuivi, createKibo, createSuivi, type FakePr, projectOf, until } from "./suivi.test-helper";

afterEach(cleanSuivi);

const BRANCH = "feat/kib-2-cache";
const FAILED: Record<string, string>[] = [
  { __typename: "CheckRun", status: "COMPLETED", conclusion: "FAILURE" },
];
const PASSED: Record<string, string>[] = [
  { __typename: "CheckRun", status: "COMPLETED", conclusion: "SUCCESS" },
];
const pr = (reviewDecision: string, statusCheckRollup: Record<string, string>[]): FakePr => ({
  number: 7,
  url: "https://github.com/kibo/test/pull/7",
  state: "OPEN",
  isDraft: false,
  head: BRANCH,
  base: "main",
  reviewDecision,
  statusCheckRollup,
});
const WAKE_UP =
  "S42 est terminé : F1 a 1 étape restante (KIB-2). Propose un report ou un retrait du planning.";

test("journal, sessions, sprint end, batches and the overview page are wired in the daemon", async () => {
  const suivi = createSuivi();
  const first = await suivi.start(0);
  const projectId = await createKibo(first, suivi.repo.repo);
  const kibo = projectOf(first, projectId);
  const feature = await kibo.create({ method: "createTicket", title: "Mode hors ligne" });
  await kibo.create({ method: "createTicket", title: "Cache local", parentId: feature, statusId: "todo" });
  const sprint = (code: string, start: string, end: string) =>
    kibo.command<Sprint>({ method: "createSprint", code, name: `Sprint ${code}`, start, end });
  const s42 = await sprint("S42", "2026-10-12", "2026-10-15");
  const s43 = await sprint("S43", "2026-10-19", "2026-10-23");
  await kibo.command({ method: "setTicketSprint", ticketId: feature, sprintId: s42.id });
  expect(await kibo.kinds()).toEqual(["sprint_created", "sprint_created", "sprint_set"]);

  expect(await kibo.session("KIB-2", "start")).toMatchObject({ tool: "T3 Code" });
  expect((await kibo.ticket("KIB-2")).session).toMatchObject({ tool: "T3 Code" });
  expect(await kibo.session("KIB-2", "stop")).toBeNull();
  expect((await kibo.ticket("KIB-2")).session).toBeNull();
  const sessionEvents = (await kibo.events({ limit: 2 })).items;
  expect(sessionEvents.map((e) => [e.kind, e.data.ticketKey])).toEqual([
    ["session_stopped", "KIB-2"],
    ["session_started", "KIB-2"],
  ]);
  expect((await kibo.ticket("KIB-2")).updatedAt).toBe(sessionEvents[0]?.at ?? -1);
  await first.stop();

  suivi.prs([pr("CHANGES_REQUESTED", FAILED)]);
  suivi.repo.git("worktree", "add", "-q", "-b", BRANCH, join(suivi.repo.dir, "kib-2"));
  const second = await suivi.start(50);
  const again = projectOf(second, projectId);
  const pages = (await again.snapshot()).pages;
  expect(pages[0]?.title).toBe("Vue d'ensemble");

  const reviewed = await until(async () => {
    const ticket = await again.ticket("KIB-2");
    return ticket.statusId === "in_review" ? ticket : undefined;
  }, "KIB-2 in review");
  expect(reviewed.externalRefs).toContainEqual(
    expect.objectContaining({ kind: "github_pr", number: 7, review: "changes_requested", checks: "error" }),
  );
  suivi.prs([pr("APPROVED", PASSED)]);
  await until(async () => ((await again.kinds()).includes("pr_checks") ? true : undefined), "pr_checks");

  const pending = await until(async () => {
    const [batch] = (await again.agent()).batches;
    return batch?.status === "pending" ? batch : undefined;
  }, "the sprint end batch");
  expect(pending.actions).toMatchObject([{ type: "setSprint", ticket: "KIB-1", sprint: "S43" }]);
  expect((await again.ticket("KIB-1")).sprintId).toBe(s42.id);
  await until(async () => ((await again.kinds()).includes("batch_proposed") ? true : undefined), "turn end");
  const decided = await second.rpc<Batch>({
    method: "decideBatch",
    projectId,
    batchId: pending.id,
    decision: "apply",
  });
  expect(decided.results.map((r) => r.outcome)).toEqual(["applied"]);
  expect((await again.ticket("KIB-1")).sprintId).toBe(s43.id);

  expect((await again.kinds()).slice(3)).toEqual([
    "session_started",
    "session_stopped",
    "branch_created",
    "status_changed",
    "pr_opened",
    "status_changed",
    "pr_review",
    "pr_checks",
    "batch_proposed",
    "batch_decided",
    "sprint_set",
  ]);
  const opened = (await again.events()).items.find((e) => e.kind === "pr_opened");
  expect(opened).toMatchObject({ source: "git", data: { number: 7, review: "changes_requested" } });
  await Bun.sleep(300);
  await second.stop();

  const third = await suivi.start(50);
  const last = projectOf(third, projectId);
  await Bun.sleep(300);
  const snapshot = await last.snapshot();
  expect(snapshot.pages.filter((p) => p.title === "Vue d'ensemble")).toHaveLength(1);
  expect(snapshot.pages[0]?.title).toBe("Vue d'ensemble");
  expect(suivi.calls().filter((c) => c.prompt.includes(WAKE_UP))).toHaveLength(1);

  const page = await last.events({ limit: 4 });
  expect(page.items).toHaveLength(4);
  expect(page.nextBefore).toBe(page.items[3]?.id ?? null);
  const next = await last.events({ limit: 4, before: page.nextBefore ?? 0 });
  expect(next.items[0]?.id).toBeLessThan(page.items[3]?.id ?? 0);
}, 90_000);
