import { expect, test } from "bun:test";
import { runDeliverySteps } from "./delivery";
import { machineLocks } from "./machine-lock";
import { PROJECT_AGENT_MCP_TOOLS } from "./project-agent-tools";
import {
  keyBesideLabel,
  openOverlapTotal,
  type RunRecord,
  runOverlapCounts,
  runSubagents,
  runSubjectBeside,
} from "./run";
import { HookInput, HookPayload, permissionReply } from "./run-hook";

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

test("a hook input may carry the tool use id", () => {
  expect(
    HookInput.parse({ hook_event_name: "PreToolUse", session_id: "s", tool_use_id: "toolu_1" }).tool_use_id,
  ).toBe("toolu_1");
  expect(HookInput.safeParse({ hook_event_name: "PreToolUse", session_id: "s" }).success).toBe(true);
  expect(HookPayload.parse(PAYLOAD).toolUseId).toBeNull();
});

test("a run record names its agent scope and project key", () => {
  const record: RunRecord = {
    id: "r",
    kind: "ticket",
    seq: 1,
    projectId: "p",
    ticketId: "t",
    ticketKey: "BOU-12",
    ticketTitle: "T",
    profileId: "global:review-pr",
    profileName: "review-pr",
    agentScope: "project",
    projectKey: "BOU",
    sessionId: "s",
    brief: "",
    createdAt: 0,
    resumedFrom: null,
  };
  expect(record.agentScope).toBe("project");
  expect(PROJECT_AGENT_MCP_TOOLS).toContain("mcp__kibo__skill_review");
});

test("a run name that already names the ticket does not get its key a second time", () => {
  expect(keyBesideLabel("kib · kibo-dev · KIB-14", "KIB-14")).toBeNull();
  expect(keyBesideLabel("opus-dev-2", "KIB-14")).toBe("KIB-14");
  expect(keyBesideLabel("kib · kibo-project-agent", null)).toBeNull();
  const run = { label: "global · livraison · KIB-14", ticketKey: "KIB-14", ticketTitle: "Récepteur" };
  expect(runSubjectBeside(run)).toBe("Récepteur");
  expect(runSubjectBeside({ ...run, label: "opus-dev-2" })).toBe("KIB-14 · Récepteur");
});

test("an agents state without overlaps counts none", () => {
  expect(runOverlapCounts({})).toEqual([]);
  expect(runOverlapCounts({ overlaps: [{ runId: "r1", open: 2 }] })).toEqual([{ runId: "r1", open: 2 }]);
  expect(openOverlapTotal({})).toBe(0);
  expect(openOverlapTotal({ overlapTotal: 1 })).toBe(1);
});

test("an agents state without locks nor delivery steps has none", () => {
  expect(machineLocks({})).toEqual([]);
  expect(runDeliverySteps({})).toEqual([]);
});

test("AgentsState without subagents lists none", () => {
  expect(runSubagents({})).toEqual([]);
});
