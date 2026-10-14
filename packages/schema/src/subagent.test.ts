import { expect, test } from "bun:test";
import { MomentData, RunMoment } from "./moment";
import { RpcRequest } from "./rpc";
import { MASKED } from "./secret-mask";
import {
  clipPrompt,
  foldSubagent,
  isSubagentRequest,
  RunSubagent,
  SUBAGENT_PROMPT_MAX,
  SUBAGENT_RESULT_MAX,
  type SubagentEvent,
  type SubagentRow,
} from "./subagent";

const SECRET = "ghp_abcdefghijklmnopqrstu1";

const ROW: SubagentRow = {
  id: "a1",
  runId: "r1",
  toolUseId: null,
  type: "ecc:code-reviewer",
  description: "",
  prompt: "",
  model: null,
  parentId: null,
  transcriptPath: null,
  startedAt: 100,
};

test("RunSubagent parses a tracked subagent", () => {
  const parsed = RunSubagent.parse({
    ...ROW,
    description: "Porte qualité",
    state: "running",
    endedAt: null,
    result: null,
    actions: 0,
  });
  expect(parsed.type).toBe("ecc:code-reviewer");
});

test("clipPrompt truncates to the prompt bound and masks secrets", () => {
  expect(clipPrompt("x".repeat(SUBAGENT_PROMPT_MAX + 1))).toHaveLength(SUBAGENT_PROMPT_MAX);
  expect(clipPrompt(`token ${SECRET}`)).toBe(`token ${MASKED}`);
});

test("a subagent without end event is running", () => {
  const folded = foldSubagent(ROW, [{ type: "started", at: 120 }]);
  expect(folded).toMatchObject({ state: "running", startedAt: 120, endedAt: null, result: null });
});

test("an ended subagent is done with its result", () => {
  const events: SubagentEvent[] = [{ type: "ended", at: 400, isError: false, result: "RAS" }];
  expect(foldSubagent(ROW, events)).toMatchObject({ state: "done", endedAt: 400, result: "RAS" });
});

test("an ended subagent in error is failed", () => {
  const events: SubagentEvent[] = [
    { type: "ended", at: 300, isError: false, result: null },
    { type: "ended", at: 500, isError: true, result: "boom" },
  ];
  expect(foldSubagent(ROW, events)).toMatchObject({ state: "failed", endedAt: 300 });
});

test("the result is masked and bounded, the last assistant text wins", () => {
  const ended: SubagentEvent = {
    type: "ended",
    at: 1,
    isError: false,
    result: `${SECRET} ${"y".repeat(3000)}`,
  };
  const fromResult = foldSubagent(ROW, [ended]).result ?? "";
  expect(fromResult.startsWith(MASKED)).toBe(true);
  expect(fromResult.length).toBeLessThanOrEqual(SUBAGENT_RESULT_MAX);
  const fromText = foldSubagent(ROW, [ended], { actions: 3, lastText: "Aucun écart" });
  expect(fromText).toMatchObject({ result: "Aucun écart", actions: 3 });
});

test("linked facts fill what the first signal did not know", () => {
  const events: SubagentEvent[] = [
    {
      type: "linked",
      at: 1,
      facts: { toolUseId: "t1", type: "Explore", description: "Repérage", prompt: "Cherche", model: "opus" },
    },
    { type: "linked", at: 2, facts: { description: "autre", parentId: "p1" } },
  ];
  expect(foldSubagent(ROW, events)).toMatchObject({
    toolUseId: "t1",
    type: "ecc:code-reviewer",
    description: "Repérage",
    prompt: "Cherche",
    model: "opus",
    parentId: "p1",
  });
});

test("a subagent moment names the subagent and moments may carry its id", () => {
  const data: MomentData = { kind: "subagent", subagentId: "a1", type: "Explore", description: "Repérage" };
  expect(MomentData.parse(data)).toEqual(data);
  const moment = RunMoment.parse({ id: 1, runId: "r1", seq: 0, at: 1, stepId: null, subagentId: "a1", data });
  expect(moment.subagentId).toBe("a1");
});

test("subagent RPC requests are read-only run requests", () => {
  const list = RpcRequest.parse({ method: "runs.subagents", runId: "r1" });
  const page = RpcRequest.parse({ method: "runs.subagentMoments", runId: "r1", subagentId: "a1", after: 4 });
  expect(isSubagentRequest(list)).toBe(true);
  expect(isSubagentRequest(page)).toBe(true);
  expect(isSubagentRequest({ method: "runMoments" })).toBe(false);
});
