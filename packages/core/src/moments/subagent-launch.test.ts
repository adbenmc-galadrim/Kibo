import { expect, test } from "bun:test";
import { foldSubagentLaunch, subagentSignals } from "./subagent-launch";

const use = (name: string, input: Record<string, unknown>) => ({
  type: "tool_use" as const,
  id: "toolu_1",
  name,
  input,
});
const REVIEW = {
  description: "Porte qualité — correctness",
  subagent_type: "ecc:code-reviewer",
  prompt: "Relis le diff",
  model: "opus",
};

test("an Agent tool use is a subagent launch", () => {
  expect(foldSubagentLaunch(use("Agent", REVIEW))).toEqual({
    toolUseId: "toolu_1",
    type: "ecc:code-reviewer",
    description: "Porte qualité — correctness",
    prompt: "Relis le diff",
    model: "opus",
  });
});

test("a Task tool use is a subagent launch too", () => {
  expect(foldSubagentLaunch(use("Task", REVIEW))?.type).toBe("ecc:code-reviewer");
});

test("a launch without subagent type is a general-purpose one", () => {
  const launch = foldSubagentLaunch(use("Agent", { description: "Cherche", prompt: "x" }));
  expect(launch).toMatchObject({ type: "general-purpose", model: null });
});

test("another tool is no launch", () => {
  expect(foldSubagentLaunch(use("Read", { file_path: "/a" }))).toBeNull();
});

test("the prompt is bounded and masked", () => {
  const launch = foldSubagentLaunch(
    use("Agent", { ...REVIEW, prompt: `ghp_abcdefghijklmnopqrstu1 ${"x".repeat(9000)}` }),
  );
  expect(launch?.prompt.length).toBe(8_000);
  expect(launch?.prompt.startsWith("ghp_")).toBe(false);
});

const line = (type: "assistant" | "user", content: unknown[]) =>
  JSON.stringify({ type, timestamp: "2026-10-14T10:00:00.000Z", message: { content } });

test("transcript lines give launches and tool results", () => {
  const signals = subagentSignals([
    line("assistant", [{ type: "tool_use", id: "toolu_1", name: "Agent", input: REVIEW }]),
    line("user", [{ type: "tool_result", tool_use_id: "toolu_1", content: "RAS", is_error: false }]),
    line("user", [
      { type: "tool_result", tool_use_id: "toolu_2", content: "Async agent launched successfully." },
    ]),
    "not json",
  ]);
  expect(signals.launches.map((l) => l.toolUseId)).toEqual(["toolu_1"]);
  expect(signals.results).toEqual([
    { toolUseId: "toolu_1", isError: false, text: "RAS" },
    { toolUseId: "toolu_2", isError: false, text: "Async agent launched successfully." },
  ]);
});
