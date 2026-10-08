import { expect, test } from "bun:test";
import { type AgentsState, ASK_QUESTION_TOOL, type HookPayload } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import { agentQuestionHooks } from "./agent-hooks";
import { answered, runView } from "./questions.test-helper";

const asked: HookPayload = {
  event: "PostToolUse",
  sessionId: "s",
  transcriptPath: null,
  tool: ASK_QUESTION_TOOL,
  detail: null,
  question: null,
  agentId: null,
  ask: { title: "Question q1", context: "", options: [], provisional: "Non", blocking: false },
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
