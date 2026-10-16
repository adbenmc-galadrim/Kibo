import { expect, test } from "bun:test";
import { EMPTY_PROGRESS, KiboError, REPORTS_MAX, type Step } from "@kibo/schema";
import { createProjectDoc } from "./project";
import { createTicket, getTicket, setTicketProgress, ticketTree } from "./tickets";
import { getNode } from "./tree";

const newDoc = () =>
  createProjectDoc({
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

const step = (id: string, status: Step["status"]): Step => ({ id, title: `Étape ${id}`, status, note: null });
const report = (done: string) => ({ done, decisions: [], toCheck: [], files: [], next: "" });

test("a ticket starts with an empty progress, even when stored without one", () => {
  const doc = newDoc();
  const ticket = createTicket(doc, { title: "Formulaire" });
  expect(ticket.agentProgress).toEqual(EMPTY_PROGRESS);
  getNode(ticketTree(doc), ticket.id).data.delete("agentProgress");
  expect(getTicket(doc, ticket.id).agentProgress).toEqual(EMPTY_PROGRESS);
});

test("a plan replaces the whole plan and records its run", () => {
  const doc = newDoc();
  const { id } = createTicket(doc, { title: "Formulaire" });
  setTicketProgress(doc, {
    ticketId: id,
    runId: "r1",
    at: 10,
    plan: [step("a", "doing"), step("b", "todo")],
  });
  const next = setTicketProgress(doc, { ticketId: id, runId: "r2", at: 20, plan: [step("c", "doing")] });
  expect(next.agentProgress).toMatchObject({
    plan: [step("c", "doing")],
    planRunId: "r2",
    planAt: 20,
    reports: [],
  });
});

test("a report replaces the report of the same run", () => {
  const doc = newDoc();
  const { id } = createTicket(doc, { title: "Formulaire" });
  setTicketProgress(doc, { ticketId: id, runId: "r1", at: 10, report: report("Premier") });
  const next = setTicketProgress(doc, { ticketId: id, runId: "r1", at: 11, report: report("Second") });
  expect(next.agentProgress.reports).toEqual([{ ...report("Second"), runId: "r1", at: 11, check: null }]);
  expect(next.agentProgress.plan).toEqual([]);
});

test("only the twenty latest reports are kept", () => {
  const doc = newDoc();
  const { id } = createTicket(doc, { title: "Formulaire" });
  for (let i = 1; i <= REPORTS_MAX + 1; i += 1) {
    setTicketProgress(doc, { ticketId: id, runId: `r${i}`, at: i, report: report(`Run ${i}`) });
  }
  const runs = getTicket(doc, id).agentProgress.reports.map((r) => r.runId);
  expect(runs).toHaveLength(REPORTS_MAX);
  expect(runs).not.toContain("r1");
  expect(runs.at(-1)).toBe(`r${REPORTS_MAX + 1}`);
});

test("the file check lands on the report of its run", () => {
  const doc = newDoc();
  const { id } = createTicket(doc, { title: "Formulaire" });
  setTicketProgress(doc, { ticketId: id, runId: "r1", at: 1, report: report("Fait") });
  setTicketProgress(doc, { ticketId: id, runId: "r2", at: 2, report: report("Fait aussi") });
  const check = { undeclared: ["src/a.ts"], unchanged: [] };
  const next = setTicketProgress(doc, { ticketId: id, runId: "r1", at: 3, check });
  expect(next.agentProgress.reports.map((r) => r.check)).toEqual([check, null]);
  expect(() => setTicketProgress(doc, { ticketId: id, runId: "r9", at: 4, check })).toThrow(KiboError);
});

test("an unknown ticket is refused", () => {
  expect(() => setTicketProgress(newDoc(), { ticketId: "9@9", runId: "r1", at: 1, plan: [] })).toThrow(
    "NOT_FOUND",
  );
});
