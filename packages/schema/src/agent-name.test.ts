import { describe, expect, test } from "bun:test";
import { agentNameProblem, claudeCodePreview, descriptionProblem, suggestAgentName } from "./agent-name";

describe("agent names", () => {
  test("a name says what the agent does", () => {
    expect(agentNameProblem("review-pr")).toBeNull();
    expect(agentNameProblem("livraison-opus")).toBeNull();
    for (const vague of ["opus", "sonnet-dev", "fable-2", "agent-1", "test", "nouveau-agent"]) {
      expect(agentNameProblem(vague)).toContain("peu parlant");
    }
    expect(agentNameProblem("Review")).toContain("invalide");
  });
  test("a name is suggested from the description", () => {
    expect(suggestAgentName("Relit une PR et rend un verdict accepté ou refusé")).toBe("relit-pr-rend");
    expect(suggestAgentName("")).toBe("");
    expect(suggestAgentName("Écrit des tests")).toBe("ecrit-tests");
    expect(suggestAgentName("x".repeat(80)).length).toBeLessThanOrEqual(40);
  });
  test("a description is one line of 20 to 200 characters", () => {
    expect(descriptionProblem("trop court")).not.toBeNull();
    expect(descriptionProblem("x".repeat(201))).not.toBeNull();
    expect(descriptionProblem("Relit une PR et\nrend un verdict")).not.toBeNull();
    expect(descriptionProblem("Relit une PR et rend un verdict")).toBeNull();
  });
  test("shows how Claude Code lists the agent", () => {
    expect(claudeCodePreview("review-pr", "Relit…")).toBe("Dans Claude Code : `review-pr` — Relit…");
  });
});
