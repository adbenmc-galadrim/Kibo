import { describe, expect, test } from "bun:test";
import { agentProfile, parseAgentFile } from "./agent-file";

const REVIEWER = `---
name: kibo-reviewer
description: Relit une tâche Kibo livrée par un dev.
model: sonnet
tools: Read, Grep, Glob, Bash
---

Tu relis la branche indiquée.
`;
const SETTINGS = { permissionMode: "plan", workspace: "worktree", maxParallel: 2 } as const;

describe("parseAgentFile", () => {
  test("reads the frontmatter fields and the body", () => {
    expect(parseAgentFile(REVIEWER)).toEqual({
      name: "kibo-reviewer",
      description: "Relit une tâche Kibo livrée par un dev.",
      model: "sonnet",
      tools: ["Read", "Grep", "Glob", "Bash"],
      body: "Tu relis la branche indiquée.",
    });
  });

  test("keeps colons inside a value", () => {
    expect(parseAgentFile(REVIEWER.replace("par un dev.", "par un dev : branche.")).description).toBe(
      "Relit une tâche Kibo livrée par un dev : branche.",
    );
  });

  test("refuses a file without frontmatter or name", () => {
    expect(() => parseAgentFile("no frontmatter")).toThrow("frontmatter");
    expect(() => parseAgentFile("---\nmodel: opus\n---\nbody")).toThrow("name");
  });
});

describe("agentProfile", () => {
  test("maps a supported model and the settings to a profile input", () => {
    const { profile, gaps } = agentProfile(parseAgentFile(REVIEWER), SETTINGS);
    expect(profile).toEqual({
      name: "kibo-reviewer",
      model: "sonnet",
      execution: "cli",
      permissionMode: "plan",
      workspace: "worktree",
      maxParallel: 2,
      subagents: [],
      enabled: true,
    });
    expect(gaps).toEqual(["kibo-reviewer: tools (Read, Grep, Glob, Bash) not expressible in a profile"]);
  });

  test("falls back to opus for an unsupported model and reports it", () => {
    const lead = parseAgentFile(REVIEWER.replace("model: sonnet", "model: fable").replace(/tools:.*\n/, ""));
    const { profile, gaps } = agentProfile(lead, SETTINGS);
    expect(profile.model).toBe("opus");
    expect(gaps).toEqual(["kibo-reviewer: model fable not supported, imported as opus"]);
  });

  test("builds the profile guideline from the description and the body", () => {
    expect(agentProfile(parseAgentFile(REVIEWER), SETTINGS).guideline).toBe(
      "# kibo-reviewer\n\nRelit une tâche Kibo livrée par un dev.\n\nTu relis la branche indiquée.\n",
    );
  });
});
