import { expect, test } from "bun:test";
import { HookInput, HookPayload, permissionReply } from "./run";

const PAYLOAD = {
  event: "Stop",
  sessionId: "s1",
  transcriptPath: null,
  tool: null,
  detail: null,
  question: null,
  agentId: null,
};

test("a hook payload defaults its todos and stop flag", () => {
  const payload = HookPayload.parse(PAYLOAD);
  expect(payload.todos).toBeNull();
  expect(payload.stopHookActive).toBe(false);
  const todos = [{ content: "Lire", status: "pending" }];
  expect(HookPayload.parse({ ...PAYLOAD, todos, stopHookActive: true })).toMatchObject({
    todos,
    stopHookActive: true,
  });
  expect(HookPayload.safeParse({ ...PAYLOAD, todos: Array(101).fill(todos[0]) }).success).toBe(false);
});

test("the hook input reads the stop flag", () => {
  const input = HookInput.parse({ hook_event_name: "Stop", session_id: "s1", stop_hook_active: true });
  expect(input.stop_hook_active).toBe(true);
});

test("a guard decision becomes a permission reply", () => {
  expect(permissionReply({ decision: "deny", reason: "non" })).toEqual({
    kind: "permission",
    decision: "deny",
    reason: "non",
    additionalContext: null,
  });
  expect(permissionReply({ decision: "allow", reason: "" }, "Déclare ton plan.")).toEqual({
    kind: "permission",
    decision: "allow",
    reason: "",
    additionalContext: "Déclare ton plan.",
  });
});
