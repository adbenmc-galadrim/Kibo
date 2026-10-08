import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AskInput, OPEN_PER_RUN_MAX, type ProjectMeta, Question, type Ticket } from "@kibo/schema";
import type { CommandEvent } from "../docs";
import { call, createService } from "../service";
import { openStore } from "../store";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const HUMAN = { kind: "human", ref: "adam" } as const;
const RUN = { id: "r1", profileName: "emis-livraison" };
const ask = (title: string, blocking = false): AskInput => ({
  title,
  context: "",
  options: ["Oui", "Non"],
  provisional: blocking ? null : "Non",
  blocking,
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "kibo-port-q-"));
  dirs.push(dir);
  const s = createService(openStore(dir), { user: "adam" });
  const project = (key: string) =>
    call(s, { method: "createProject", name: key, key, folder: null, color: "#F97316" }) as ProjectMeta;
  const ticket = (projectId: string) =>
    call(s, {
      method: "command",
      projectId,
      command: { method: "createTicket", title: "A", statusId: "in_progress" },
    }) as Ticket;
  const events: CommandEvent[] = [];
  s.commands.onCommand((e) => events.push(e));
  return { s, project, ticket, events };
}

test("an agent question is created for its run, as the agent, without touching the status", () => {
  const { s, project, ticket, events } = setup();
  const p = project("EMIS");
  const t = ticket(p.id);
  events.length = 0;
  const q = s.agentData.createQuestion(p.id, t.id, RUN, ask("Bloquer le dépôt ?"));
  expect(q).toMatchObject({
    ticketId: t.id,
    runId: "r1",
    blocking: false,
    provisional: "Non",
    createdBy: { kind: "agent", ref: "emis-livraison" },
  });
  expect(events.map((e) => [e.command.method, e.meta.origin])).toEqual([["createQuestion", "agent"]]);
  expect(s.agentData.ticketContext(p.id, t.id).ticket.statusId).toBe("in_progress");
});

test("a run past its open questions quota is ignored and nothing is sent", () => {
  const { s, project, ticket, events } = setup();
  const p = project("EMIS");
  const t = ticket(p.id);
  for (let i = 0; i < OPEN_PER_RUN_MAX; i++) s.agentData.createQuestion(p.id, t.id, RUN, ask(`Q${i}`));
  events.length = 0;
  expect(s.agentData.createQuestion(p.id, t.id, RUN, ask("Une de trop"))).toBeNull();
  expect(events).toEqual([]);
});

test("the drawer answer goes to the open blocking question of the run", () => {
  const { s, project, ticket } = setup();
  const p = project("EMIS");
  const t = ticket(p.id);
  s.agentData.createQuestion(p.id, t.id, RUN, ask("À valider"));
  expect(s.agentData.answerRunQuestion(p.id, "r1", "443", HUMAN)).toBeNull();
  const blocking = s.agentData.createQuestion(p.id, t.id, RUN, ask("Quel port ?", true));
  const answered = s.agentData.answerRunQuestion(p.id, "r1", "443", HUMAN);
  expect(answered?.id).toBe(blocking?.id ?? "");
  expect(answered?.answer).toMatchObject({ kind: "text", text: "443", by: HUMAN });
  expect(s.agentData.answerRunQuestion(p.id, "r1", "encore", HUMAN)).toBeNull();
});

test("run counts span every project, and delivery marks answers with the reserved command", () => {
  const { s, project, ticket, events } = setup();
  const [a, b] = [project("EMIS"), project("KIB")];
  const [ta, tb] = [ticket(a.id), ticket(b.id)];
  const q1 = Question.parse(s.agentData.createQuestion(a.id, ta.id, RUN, ask("Q1")));
  s.agentData.createQuestion(a.id, ta.id, RUN, ask("Q2"));
  s.agentData.createQuestion(b.id, tb.id, { id: "r2", profileName: "opus" }, ask("Q3"));
  call(s, {
    method: "command",
    projectId: a.id,
    command: { method: "answerQuestion", questionId: q1.id, answer: { kind: "confirm" }, by: HUMAN },
  });
  expect(s.agentData.runQuestions()).toEqual([
    { runId: "r1", open: 1, undelivered: 1, latestTitle: "Q2" },
    { runId: "r2", open: 1, undelivered: 0, latestTitle: "Q3" },
  ]);
  expect(s.agentData.undeliveredAnswers(a.id, ta.id).map((q) => q.id)).toEqual([q1.id]);
  events.length = 0;
  s.agentData.markAnswersDelivered(a.id, ta.id, [q1.id], "r5");
  expect(events.map((e) => [e.command.method, e.meta.origin])).toEqual([["markAnswersDelivered", "agent"]]);
  expect(s.agentData.undeliveredAnswers(a.id, ta.id)).toEqual([]);
  expect(s.agentData.runQuestions()[0]).toEqual({ runId: "r1", open: 1, undelivered: 0, latestTitle: "Q2" });
  s.agentData.markAnswersDelivered(a.id, ta.id, [], "r5");
  expect(events).toHaveLength(1);
});
