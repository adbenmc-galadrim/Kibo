import { expect, test } from "bun:test";
import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import { type ProjectCommand, type RunView, type Step, Ticket } from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";
import type { CommandMeta } from "../docs";
import { runView } from "../questions/questions.test-helper";
import { createProgressService, type ProgressTrace } from "./service";

const PLAN: Step[] = [
  { id: "s1", title: "Lire le formulaire", status: "done", note: null },
  { id: "s2", title: "Corriger la validation", status: "doing", note: null },
  { id: "s3", title: "Tester", status: "todo", note: null },
];
const REPORT = { done: "Validation corrigée", toCheck: ["Le message d'erreur"], files: ["src/form.ts"] };

function kit(
  gitReplies: Record<string, { code: number; stdout: string }> = {},
  earlier: (ticketId: string) => RunView[] = () => [],
) {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
  });
  const ticket = Ticket.parse(executeProjectCommand(doc, { method: "createTicket", title: "Formulaire" }));
  const commands: { projectId: string; cmd: ProjectCommand; meta: CommandMeta }[] = [];
  const traces = new Map<string, { doing: string | null; baseHead: string | null }>();
  const gitCalls: string[][] = [];
  const changes: number[] = [];
  const git: GitRunner = async (args) => {
    gitCalls.push(args);
    const reply = gitReplies[args[0] ?? ""] ?? { code: 128, stdout: "" };
    return { ...reply, stderr: "" };
  };
  const trace: ProgressTrace = {
    setDoingStep: (runId, stepId) =>
      traces.set(runId, { baseHead: null, ...traces.get(runId), doing: stepId }),
    setBaseHead: (runId, head) => traces.set(runId, { doing: null, ...traces.get(runId), baseHead: head }),
    trace: (runId) => {
      const t = traces.get(runId);
      return t ? { baseHead: t.baseHead } : null;
    },
  };
  const service = createProgressService({
    docs: {
      snapshot: () => readProject(doc),
      run(projectId, cmd, meta) {
        commands.push({ projectId, cmd, meta });
        return executeProjectCommand(doc, cmd);
      },
    },
    git,
    trace,
    runs: () => earlier(ticket.id),
    now: () => 1_000,
    changed: () => changes.push(commands.length),
  });
  const run = runView({ id: "r1", projectId: "p1", ticketId: ticket.id, cwd: "/repo", state: "running" });
  const progressOf = () => readProject(doc).tickets.find((t) => t.id === ticket.id)?.agentProgress;
  return { service, run, ticket, commands, traces, gitCalls, progressOf, changes };
}

test("a plan is written on the run's ticket by the daemon and the doing step is traced", async () => {
  const k = kit();
  expect(await k.service.record(k.run, { plan: PLAN })).toBe("Plan enregistré.");
  expect(k.commands).toEqual([
    {
      projectId: "p1",
      cmd: { method: "setTicketProgress", ticketId: k.ticket.id, runId: "r1", at: 1_000, plan: PLAN },
      meta: { origin: "agent", instanceId: null },
    },
  ]);
  expect(k.progressOf()).toMatchObject({ plan: PLAN, planRunId: "r1", planAt: 1_000 });
  expect(k.traces.get("r1")?.doing).toBe("s2");
  expect(k.service.hasPlan(k.run)).toBe(true);
  expect(k.service.hasPlan({ ...k.run, id: "r2" })).toBe(false);
});

test("a report alone is recorded once per run and does not touch the doing step", async () => {
  const k = kit();
  expect(k.service.hasReport(k.run)).toBe(false);
  expect(await k.service.record(k.run, { report: { ...REPORT, decisions: [], next: "" } })).toBe(
    "Compte rendu enregistré.",
  );
  await k.service.record(k.run, { report: { ...REPORT, done: "Encore", decisions: [], next: "" } });
  expect(k.progressOf()?.reports.map((r) => [r.runId, r.done])).toEqual([["r1", "Encore"]]);
  expect(k.service.hasReport(k.run)).toBe(true);
  expect(k.traces.has("r1")).toBe(false);
});

test("a run without a ticket cannot record progress", async () => {
  const k = kit();
  await expect(k.service.record({ ...k.run, ticketId: null }, { plan: PLAN })).rejects.toMatchObject({
    code: "INVALID_INPUT",
    detail: "run without ticket",
  });
  expect(k.commands).toEqual([]);
});

test("the base of the run is the HEAD of its workspace at the first spawn, null outside git", async () => {
  const k = kit({ "rev-parse": { code: 0, stdout: "abc123\n" } });
  await k.service.onSpawned(k.run);
  expect(k.traces.get("r1")?.baseHead).toBe("abc123");
  await k.service.onSpawned(k.run);
  expect(k.gitCalls.filter((a) => a[0] === "rev-parse")).toHaveLength(1);
  const outside = kit();
  await outside.service.onSpawned(outside.run);
  expect(outside.traces.get("r1")?.baseHead).toBeNull();
  await outside.service.onSpawned({ ...outside.run, id: "r9", cwd: null });
  expect(outside.traces.get("r9")?.baseHead).toBeNull();
});

test("a resumed run keeps the base of the first traced run of its ticket in the same workspace", async () => {
  const earlier = (ticketId: string) => [
    runView({ id: "r0", ticketId, cwd: "/repo", createdAt: 10 }),
    runView({ id: "r-other", ticketId: "elsewhere", cwd: "/repo", createdAt: 5 }),
    runView({ id: "r-moved", ticketId, cwd: "/other", createdAt: 1 }),
    runView({ id: "r-untraced", ticketId, cwd: "/repo", createdAt: 2 }),
  ];
  const k = kit({ "rev-parse": { code: 0, stdout: "712eb25\n" } }, earlier);
  k.traces.set("r0", { doing: null, baseHead: "b96c219" });
  k.traces.set("r-other", { doing: null, baseHead: "other" });
  k.traces.set("r-moved", { doing: null, baseHead: "moved" });
  await k.service.onSpawned({ ...k.run, workspace: "worktree:kib-1", createdAt: 20 });
  expect(k.traces.get("r1")?.baseHead).toBe("b96c219");
  expect(k.gitCalls).toEqual([]);
});

test("a run in the project folder takes HEAD even after a traced run of its ticket", async () => {
  const earlier = (ticketId: string) => [runView({ id: "r0", ticketId, cwd: "/repo", createdAt: 10 })];
  const k = kit({ "rev-parse": { code: 0, stdout: "head9\n" } }, earlier);
  k.traces.set("r0", { doing: null, baseHead: "old" });
  await k.service.onSpawned({ ...k.run, workspace: "repo", createdAt: 20 });
  expect(k.traces.get("r1")?.baseHead).toBe("head9");
});

test("a worktree run without traced predecessor takes the merge-base with its base branch", async () => {
  const k = kit({ "merge-base": { code: 0, stdout: "fork42\n" }, "rev-parse": { code: 0, stdout: "head9" } });
  await k.service.onSpawned({ ...k.run, workspace: "worktree:kib-1" });
  expect(k.traces.get("r1")?.baseHead).toBe("fork42");
  expect(k.gitCalls).toEqual([["merge-base", "HEAD", "main"]]);
  const lost = kit({ "rev-parse": { code: 0, stdout: "head9" } });
  await lost.service.onSpawned({ ...lost.run, workspace: "worktree:kib-1" });
  expect(lost.traces.get("r1")?.baseHead).toBe("head9");
});

test("the end of a turn checks the reported files against the workspace", async () => {
  const k = kit({
    "rev-parse": { code: 0, stdout: "abc123" },
    diff: { code: 0, stdout: "src/form.ts\0src/extra.ts\0" },
    "ls-files": { code: 0, stdout: "" },
  });
  await k.service.onSpawned(k.run);
  await k.service.onTurnEnd(k.run);
  expect(k.commands).toEqual([]);
  await k.service.record(k.run, {
    report: { ...REPORT, files: ["./src/form.ts", "README.md"], decisions: [], next: "" },
  });
  await k.service.onTurnEnd(k.run);
  expect(k.commands.at(-1)?.cmd).toEqual({
    method: "setTicketProgress",
    ticketId: k.ticket.id,
    runId: "r1",
    at: 1_000,
    check: { undeclared: ["src/extra.ts"], unchanged: ["README.md"] },
  });
  expect(k.progressOf()?.reports[0]?.check).toEqual({
    undeclared: ["src/extra.ts"],
    unchanged: ["README.md"],
  });
  expect(k.changes).toEqual([1, 2]);
});

test("without a base or outside git the files stay unchecked", async () => {
  const k = kit({ diff: { code: 128, stdout: "" } });
  await k.service.record(k.run, { report: { ...REPORT, decisions: [], next: "" } });
  await k.service.onTurnEnd(k.run);
  k.traces.set("r1", { doing: null, baseHead: "abc123" });
  await k.service.onTurnEnd(k.run);
  expect(k.commands).toHaveLength(1);
  expect(k.progressOf()?.reports[0]?.check).toBeNull();
});

test("summaries come from the ticket and skip runs without a ticket", async () => {
  const k = kit();
  expect(k.service.summary(k.run)).toEqual({ runId: "r1", step: null, report: null });
  await k.service.record(k.run, { plan: PLAN, report: { ...REPORT, decisions: [], next: "" } });
  const expected = {
    runId: "r1",
    step: { index: 2, total: 3, title: "Corriger la validation" },
    report: { toCheck: 1, undeclared: 0 },
  };
  expect(k.service.summary(k.run)).toEqual(expected);
  const task: RunView = { ...k.run, id: "task", projectId: null, ticketId: null };
  expect(k.service.summary(task)).toBeNull();
  expect(k.service.summary({ ...k.run, ticketId: "0@0" })).toBeNull();
  expect(k.service.summaries([task, k.run])).toEqual([expected]);
});
