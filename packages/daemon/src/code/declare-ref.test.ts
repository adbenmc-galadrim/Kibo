import { afterEach, beforeEach, expect, test } from "bun:test";
import { type GitBranchRef, type GithubPrRef, KiboError, type StatusId, type Ticket } from "@kibo/schema";
import { type EventsHarness, eventsHarness, PR_18, tick } from "../events/events.test-helper";
import { dispatchRpc, LOCAL_CONTEXT } from "../rpc-extensions";
import { call } from "../service";
import { declareRefRpc, declareTicketRef } from "./declare-ref";

let h: EventsHarness;
beforeEach(() => {
  h = eventsHarness();
});
afterEach(() => h.close());

const BRANCH: GitBranchRef = { kind: "git_branch", branch: "feat/emis-1", base: "dev" };

function step(statusId: StatusId = "todo"): Ticket {
  const ticket = h.run({ method: "createTicket", title: "Envoi" }) as Ticket;
  if (statusId !== "todo") h.run({ method: "setStatus", ticketId: ticket.id, statusId });
  return ticket;
}

const declare = (ticket: Ticket, ref: GitBranchRef | GithubPrRef) =>
  declareTicketRef(h.service, { projectId: h.project.id, ticketKey: ticket.key ?? "", ref });

const statusOf = (id: string) =>
  call(h.service, { method: "getProject", projectId: h.project.id }).tickets.find((t) => t.id === id)
    ?.statusId;

async function kinds(ticketId: string): Promise<string[]> {
  await tick();
  return h
    .journal()
    .filter((e) => e.ticketId === ticketId)
    .map((e) => e.kind);
}

test("a branch declared on a ticket to do starts it, with the observer's journal", async () => {
  const ticket = step();
  const before = (await kinds(ticket.id)).length;
  const result = declare(ticket, BRANCH);
  expect(result.statusChanged).toBe(true);
  expect(result.ticket.statusId).toBe("in_progress");
  expect(result.ticket.externalRefs).toContainEqual(BRANCH);
  expect((await kinds(ticket.id)).slice(before)).toEqual(["branch_created", "status_changed"]);
});

test("a branch declared on a ticket in review leaves its status", () => {
  const ticket = step("in_review");
  const result = declare(ticket, BRANCH);
  expect(result.statusChanged).toBe(false);
  expect(statusOf(ticket.id)).toBe("in_review");
});

test("an open PR declared on a ticket in progress sends it to review", async () => {
  const ticket = step("in_progress");
  const before = (await kinds(ticket.id)).length;
  const result = declare(ticket, PR_18);
  expect(result).toMatchObject({ statusChanged: true, ticket: { statusId: "in_review" } });
  expect((await kinds(ticket.id)).slice(before)).toEqual(["pr_opened", "status_changed"]);
});

test("a merged PR completes the ticket", async () => {
  const ticket = step("in_review");
  h.run({ method: "upsertExternalRef", ticketId: ticket.id, ref: { ...PR_18, base: "main" } });
  const result = declare(ticket, { ...PR_18, state: "merged", base: null });
  expect(result).toMatchObject({ statusChanged: true, ticket: { statusId: "done" } });
  expect(await kinds(ticket.id)).toContain("pr_merged");
});

test("a PR declared again keeps what the poller learnt about it", () => {
  const ticket = step("in_review");
  const known: GithubPrRef = { ...PR_18, review: "approved", checks: "ok" };
  h.run({ method: "upsertExternalRef", ticketId: ticket.id, ref: known });
  const result = declare(ticket, { ...PR_18, base: null, head: null, review: "none", checks: null });
  expect(result.ticket.externalRefs).toContainEqual(known);
});

test("the same reference declared twice records nothing more", async () => {
  const ticket = step();
  declare(ticket, BRANCH);
  declare(ticket, PR_18);
  const before = await kinds(ticket.id);
  expect(declare(ticket, BRANCH).statusChanged).toBe(false);
  expect(declare(ticket, PR_18).statusChanged).toBe(false);
  expect(await kinds(ticket.id)).toEqual(before);
});

test("a reference written by a plain command runs no rule", () => {
  const ticket = step();
  h.run({ method: "upsertExternalRef", ticketId: ticket.id, ref: BRANCH });
  h.run({ method: "upsertExternalRef", ticketId: ticket.id, ref: PR_18 });
  expect(statusOf(ticket.id)).toBe("todo");
});

test("an unknown ticket is not found", () => {
  const run = () =>
    declareTicketRef(h.service, { projectId: h.project.id, ticketKey: "EMIS-99", ref: BRANCH });
  expect(run).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
});

test("a project that cannot be written refuses the declaration and moves nothing", () => {
  const ticket = step();
  const off = h.service.docs.setWriteGuard(() => {
    throw new KiboError("FORBIDDEN", "read-only");
  });
  expect(() => declare(ticket, BRANCH)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  off();
  expect(statusOf(ticket.id)).toBe("todo");
});

test("the RPC answers on this machine only", async () => {
  const ticket = step();
  const req = {
    method: "declareTicketRef" as const,
    projectId: h.project.id,
    ticketKey: ticket.key ?? "",
    ref: BRANCH,
  };
  const remote = dispatchRpc(h.service, [declareRefRpc(h.service)], req, { ...LOCAL_CONTEXT, remote: true });
  await expect(remote).rejects.toMatchObject({ code: "FORBIDDEN" });
  const local = await dispatchRpc(h.service, [declareRefRpc(h.service)], req, LOCAL_CONTEXT);
  expect(local).toMatchObject({ statusChanged: true });
});
