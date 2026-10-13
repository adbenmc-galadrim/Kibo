import { describe, expect, test } from "bun:test";
import { agentGuard } from "../agents/guard";
import { actionsOf, fixtureLines, foldAll } from "./fold-moments.test-helper";

describe("a session that uses skills", () => {
  const moments = foldAll(fixtureLines("skill"));
  const actions = actionsOf(moments);

  test("a Skill call is a skill action carrying its tool use id", () => {
    expect(actions[0]).toMatchObject({
      tool: "Skill",
      kind: "skill",
      target: "superpowers:brainstorming",
      label: "A utilisé le skill `superpowers:brainstorming`",
      outcome: "ok",
      callId: "toolu_skill_ok",
    });
  });

  test("a Skill refused by the Kibo guard is denied", () => {
    const reason = agentGuard({
      subagents: [],
      genericSubagents: false,
      allSubagents: false,
      skills: { mode: "list", ids: [] },
    })({
      tool: "Skill",
      input: { skill: "deploy" },
    })?.reason;
    expect(reason).toBe("skill non autorisé par Kibo : deploy");
    expect(actions[1]).toMatchObject({
      kind: "skill",
      target: "deploy",
      outcome: "denied",
      callId: "toolu_skill_denied",
    });
  });

  test("a skill review is labelled with its number of skills", () => {
    expect(actions[2]).toMatchObject({
      kind: "mcp",
      target: "skill_review",
      label: "A laissé une review de 1 skill",
    });
  });
});

test("each skill use and each refusal is its own actions moment", () => {
  const groups = foldAll(fixtureLines("skill")).flatMap((m) =>
    m.data.kind === "actions" ? [m.data.actions.map((a) => a.kind)] : [],
  );
  expect(groups.filter((g) => g.includes("skill"))).toEqual([["skill"], ["skill"]]);
});
