import { describe, expect, test } from "bun:test";
import { actionsOf, fixtureLines, foldAll } from "./fold-moments.test-helper";

describe("a real 2.1.296 session with skills and subagents", () => {
  const moments = foldAll(fixtureLines("real-subagents-2-1-296"));
  const actions = actionsOf(moments);
  const summaries = moments.flatMap((m) => (m.data.kind === "actions" ? [m.data.summary] : []));

  test("session metadata never becomes a moment", () => {
    expect(moments.map((m) => m.data.kind)).toEqual([
      "actions",
      "actions",
      "actions",
      "message",
      "actions",
      "message",
    ]);
  });

  test("the skill use is told", () => {
    expect(summaries[0]).toBe("A utilisé le skill `regle-panier`");
  });

  test("the review subagent is launched asynchronously through the Agent tool", () => {
    expect(actions[1]).toMatchObject({ tool: "Agent", kind: "subagent", target: "review", outcome: "ok" });
    expect(actions[1]?.detail).toStartWith("Async agent launched successfully.");
  });

  test("the seo subagent refused by the Kibo PreToolUse hook is told", () => {
    expect(actions[2]).toMatchObject({
      tool: "Agent",
      kind: "subagent",
      target: "seo",
      outcome: "denied",
      detail: "PreToolUse:Agent hook error: sous-agent non autorisé par Kibo : seo",
    });
    expect(summaries[2]).toBe("Kibo a refusé le sous-agent `seo`");
  });

  test("the skill review is told", () => {
    expect(summaries[3]).toBe("A laissé une review de 1 skill");
  });
});
