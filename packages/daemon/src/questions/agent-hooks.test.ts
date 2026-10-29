import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentsState, ASK_QUESTION_TOOL, type HookPayload, Ticket } from "@kibo/schema";
import type { Notice } from "../runs/notifier";
import { call, createService } from "../service";
import { openStore } from "../store";
import { agentQuestionHooks } from "./agent-hooks";
import { answered, runView } from "./questions.test-helper";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const asked: HookPayload = {
  event: "PostToolUse",
  sessionId: "s",
  transcriptPath: null,
  tool: ASK_QUESTION_TOOL,
  detail: null,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: {
    kind: "question",
    images: [],
    title: "Question q1",
    context: "",
    options: [],
    provisional: "Non",
    blocking: false,
    recipient: null,
  },
  todos: null,
  stopHookActive: false,
};

test("without agents no hook is verified nor received", () => {
  const hooks = agentQuestionHooks(
    () => null,
    { createQuestion: () => null },
    () => {},
  );
  expect(hooks.verify("r1", "t")).toBe(false);
  expect(hooks.receive("r1", asked, null)).toBeNull();
});

test("a question asked by a running agent is notified with its ticket", () => {
  const notices: Notice[] = [];
  const run = runView({ id: "r1", state: "running", label: "opus-dev-2" });
  const agents = {
    hooks: { verify: () => true, receive: () => null },
    state: (): Pick<AgentsState, "runs"> => ({ runs: [run] }),
  };
  const hooks = agentQuestionHooks(
    () => agents,
    { createQuestion: () => answered("q1") },
    (n) => notices.push(n),
  );
  expect(hooks.verify("r1", "t")).toBe(true);
  hooks.receive("r1", asked, null);
  expect(notices).toEqual([{ title: "opus-dev-2 a posé une question", body: "KIB-14 · Question q1" }]);
});

test("an asked question goes to the recipient the agent proposes, by name or id, else to me", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-agent-hooks-"));
  dirs.push(dir);
  const s = createService(openStore(dir), { user: "adam" });
  const project = call(s, {
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder: null,
    color: "#F97316",
  });
  const ticket = Ticket.parse(
    call(s, {
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: "Tarifs" },
    }),
  );
  const run = runView({ id: "r1", projectId: project.id, ticketId: ticket.id, state: "running" });
  const agents = {
    hooks: { verify: () => true, receive: () => null },
    state: (): Pick<AgentsState, "runs"> => ({ runs: [run] }),
  };
  const hooks = agentQuestionHooks(
    () => agents,
    s.agentData,
    () => {},
  );
  const askTo = (title: string, recipient: string | null) => {
    const ask = {
      title,
      context: "",
      options: [],
      provisional: null,
      blocking: false,
      recipient,
      kind: "question" as const,
      images: [],
    };
    hooks.receive("r1", { ...asked, ask }, null);
  };
  askTo("Quel tarif ?", "Client");
  askTo("Quel parcours ?", "product");
  askTo("Quelle licence ?", "juridique");
  askTo("Quel port ?", null);
  const recipients = call(s, {
    kind: "question",
    images: [],
    method: "getProject",
    projectId: project.id,
  }).questions.map((q) => [q.title, q.recipient]);
  expect(recipients).toEqual([
    ["Quel tarif ?", "client"],
    ["Quel parcours ?", "product"],
    ["Quelle licence ?", "me"],
    ["Quel port ?", "me"],
  ]);
});
