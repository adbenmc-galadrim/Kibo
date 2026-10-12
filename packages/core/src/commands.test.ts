import { describe, expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, KiboError, type Page, type Question, type Ticket } from "@kibo/schema";
import { assertShellCommand, createProjectDoc, executeProjectCommand, readProject } from "./index";

const doc = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
  });

describe("project commands", () => {
  test("builds a page with a kanban and a ticket, visible in the snapshot", () => {
    const d = doc();
    const page = executeProjectCommand(d, { method: "addPage", title: "Kanban", kind: "view" }) as Page;
    executeProjectCommand(d, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
    const a = executeProjectCommand(d, { method: "createTicket", title: "A" }) as Ticket;
    const b = executeProjectCommand(d, { method: "createTicket", title: "B", parentId: a.id }) as Ticket;
    executeProjectCommand(d, { method: "addLink", from: b.id, to: a.id, type: "relates" });
    const snap = readProject(d);
    expect(snap.meta.key).toBe("KIB");
    expect(snap.workflow).toHaveLength(6);
    expect(snap.instances).toMatchObject([
      { pageId: page.id, component: "kanban@1.0.0", layout: { x: 0, y: 0, w: 12, h: 6 } },
    ]);
    expect(snap.tickets.find((t) => t.id === a.id)).toMatchObject({
      progress: { done: 0, total: 1 },
      waitingOn: [],
    });
    expect(snap.links).toHaveLength(1);
  });

  test("a view page holds a single component", () => {
    const d = doc();
    const page = executeProjectCommand(d, { method: "addPage", title: "Kanban", kind: "view" }) as Page;
    executeProjectCommand(d, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
    expect(() =>
      executeProjectCommand(d, { method: "addInstance", pageId: page.id, component: "tickets@1.0.0" }),
    ).toThrow("INVALID_INPUT");
  });

  test("deleting a page removes the instances of the page and of its sub-pages", () => {
    const d = doc();
    const board = executeProjectCommand(d, { method: "addPage", title: "Board", kind: "dashboard" }) as Page;
    const sub = executeProjectCommand(d, {
      method: "addPage",
      title: "Sub",
      kind: "view",
      parentId: board.id,
    }) as Page;
    executeProjectCommand(d, { method: "addInstance", pageId: board.id, component: "tickets@1.0.0" });
    executeProjectCommand(d, { method: "addInstance", pageId: sub.id, component: "kanban@1.0.0" });
    executeProjectCommand(d, { method: "deletePage", pageId: board.id });
    expect(readProject(d).instances).toEqual([]);
  });

  test("an instance needs an existing page", () => {
    expect(() =>
      executeProjectCommand(doc(), { method: "addInstance", pageId: "9@9", component: "kanban@1.0.0" }),
    ).toThrow("NOT_FOUND");
  });
});

const AGENT = { kind: "agent", ref: "kibo-dev" } as const;

function ticketIn(d: ReturnType<typeof doc>, title: string, statusId: Ticket["statusId"] = "todo"): Ticket {
  const ticket = executeProjectCommand(d, { method: "createTicket", title, statusId });
  if (!isTicket(ticket)) throw new Error("createTicket returned no ticket");
  return ticket;
}

const isTicket = (value: unknown): value is Ticket =>
  typeof value === "object" && value !== null && "statusId" in value;
const isQuestion = (value: unknown): value is Question =>
  typeof value === "object" && value !== null && "ticketId" in value && "title" in value;

function askOn(d: ReturnType<typeof doc>, ticketId: string, blocking: boolean): Question {
  const question = executeProjectCommand(d, {
    method: "createQuestion",
    ticketId,
    title: blocking ? "Bloquante ?" : "Simple ?",
    blocking,
    createdBy: AGENT,
  });
  if (!isQuestion(question)) throw new Error("createQuestion returned no question");
  return question;
}

const startable = (d: ReturnType<typeof doc>, id: string, busy: string[] = []) =>
  readProject(d, { busyTickets: new Set(busy) }).tickets.find((t) => t.id === id)?.startable;

describe("visibility commands", () => {
  test("the progress and recipient commands are routed", () => {
    const d = doc();
    const ticket = ticketIn(d, "Formulaire");
    const question = askOn(d, ticket.id, false);
    const progressed = executeProjectCommand(d, {
      method: "setTicketProgress",
      ticketId: ticket.id,
      runId: "r1",
      at: 5,
      plan: [{ id: "a", title: "Lire", status: "doing", note: null }],
    });
    expect(progressed).toMatchObject({ agentProgress: { planRunId: "r1", planAt: 5 } });
    expect(executeProjectCommand(d, { method: "addQuestionRecipient", name: "Juridique" })).toMatchObject({
      name: "Juridique",
    });
    expect(
      executeProjectCommand(d, { method: "renameQuestionRecipient", recipientId: "product", name: "PO" }),
    ).toEqual({ id: "product", name: "PO" });
    expect(
      executeProjectCommand(d, {
        method: "setQuestionRecipient",
        questionId: question.id,
        recipient: "client",
      }),
    ).toMatchObject({ recipient: "client" });
    expect(
      executeProjectCommand(d, { method: "markQuestionSent", questionId: question.id, at: 9 }),
    ).toMatchObject({ sentAt: 9 });
    expect(
      executeProjectCommand(d, { method: "removeQuestionRecipient", recipientId: "product" }),
    ).toBeNull();
    expect(readProject(d).questionRecipients.map((r) => r.id)).toEqual(["me", "client", expect.any(String)]);
  });

  test("the ticket progress is refused to the shell", () => {
    expect(() =>
      assertShellCommand({ method: "setTicketProgress", ticketId: "t1", runId: "r1", at: 1 }),
    ).toThrow(KiboError);
    expect(() => assertShellCommand({ method: "markQuestionSent", questionId: "q1" })).not.toThrow();
  });

  test("a snapshot carries the default recipients", () => {
    expect(readProject(doc()).questionRecipients).toEqual([...DEFAULT_RECIPIENTS]);
  });

  test("a ticket is startable when nothing holds it", () => {
    const d = doc();
    const todo = ticketIn(d, "À faire");
    const backlog = ticketIn(d, "Backlog", "backlog");
    const doing = ticketIn(d, "En cours", "in_progress");
    expect(startable(d, todo.id)).toBe(true);
    expect(startable(d, backlog.id)).toBe(true);
    expect(startable(d, doing.id)).toBe(false);
    expect(startable(d, todo.id, [todo.id])).toBe(false);
    expect(readProject(d).tickets.find((t) => t.id === todo.id)?.startable).toBe(true);
  });

  test("blockers and blocking questions hold a ticket", () => {
    const d = doc();
    const blocker = ticketIn(d, "Bloqueur", "in_review");
    const held = ticketIn(d, "Attend");
    const related = ticketIn(d, "Lié", "in_progress");
    executeProjectCommand(d, { method: "addLink", from: blocker.id, to: held.id, type: "blocks" });
    executeProjectCommand(d, { method: "addLink", from: related.id, to: held.id, type: "relates" });
    expect(startable(d, held.id)).toBe(false);
    executeProjectCommand(d, { method: "setStatus", ticketId: blocker.id, statusId: "done" });
    expect(startable(d, held.id)).toBe(true);
    askOn(d, held.id, false);
    expect(startable(d, held.id)).toBe(true);
    const blocking = askOn(d, held.id, true);
    expect(startable(d, held.id)).toBe(false);
    executeProjectCommand(d, { method: "archiveQuestion", questionId: blocking.id, by: AGENT });
    expect(startable(d, held.id)).toBe(true);
  });

  test("the question edit commands are routed", () => {
    const d = doc();
    const question = askOn(d, ticketIn(d, "Formulaire").id, false);
    const by = AGENT;
    const questionId = question.id;
    const run = (cmd: Parameters<typeof executeProjectCommand>[1]) => executeProjectCommand(d, cmd);
    expect(run({ method: "updateQuestion", questionId, by, title: "Renommée ?" })).toMatchObject({
      title: "Renommée ?",
    });
    run({ method: "answerQuestion", questionId, by, answer: { kind: "text", text: "Oui" } });
    expect(
      run({ method: "updateAnswer", questionId, by, answer: { kind: "text", text: "Non" } }),
    ).toMatchObject({
      answer: { text: "Non" },
    });
    expect(run({ method: "reopenQuestion", questionId, by })).toMatchObject({ answer: null });
    expect(run({ method: "archiveQuestion", questionId, by, at: 7 })).toMatchObject({ archivedAt: 7 });
    expect(run({ method: "restoreQuestion", questionId, by })).toMatchObject({ archivedAt: null });
  });
});
