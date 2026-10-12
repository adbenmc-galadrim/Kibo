import { expect, test } from "bun:test";
import { DEFAULT_AGENT_SETTINGS } from "@kibo/schema";
import { agentSummary } from "./summary";

const base = {
  ref: "global:review-pr",
  scope: "global" as const,
  projectId: null,
  name: "review-pr",
  path: "/h/.claude/agents/review-pr.md",
  hash: null,
  problem: null,
  nameWarning: null,
  settings: DEFAULT_AGENT_SETTINGS,
  shadowedBy: null,
  activeRuns: 0,
  modifiedAt: null,
};

test("a summary keeps the description and the model, and counts the skills and subagents", () => {
  const file = {
    frontmatter: { name: "review-pr", description: "Relit", model: "opus", extra: "", extraKeys: [] },
    body: "",
  };
  const settings = {
    ...DEFAULT_AGENT_SETTINGS,
    subagents: ["global:a"],
    skills: { mode: "list" as const, ids: ["x", "y"] },
  };
  const summary = agentSummary({ ...base, file, settings });
  expect(summary).toMatchObject({ description: "Relit", model: "opus", skillsCount: 2, subagentsCount: 1 });
  expect("file" in summary).toBe(false);
  expect(agentSummary({ ...base, file: null })).toMatchObject({
    description: "",
    model: null,
    skillsCount: null,
  });
});
