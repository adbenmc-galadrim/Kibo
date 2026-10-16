import { expect, test } from "bun:test";
import { DEFAULT_RULES, Rule } from "./rule";

test("the default rules move a ticket in progress when its branch is created", () => {
  expect(DEFAULT_RULES).toHaveLength(5);
  expect(DEFAULT_RULES.find((r) => r.id === "branch-created-in-progress")).toEqual({
    id: "branch-created-in-progress",
    enabled: true,
    when: "branch_created",
    from: ["backlog", "todo"],
    to: "in_progress",
  });
  expect(DEFAULT_RULES.find((r) => r.id === "run-started-in-progress")?.when).toBe("run_started");
  for (const rule of DEFAULT_RULES) expect(Rule.safeParse(rule).success).toBe(true);
  expect(Rule.safeParse({ ...DEFAULT_RULES[0], when: "branch_deleted" }).success).toBe(false);
});
