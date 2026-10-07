import { expect, test } from "bun:test";
import fc from "fast-check";
import { ALLOW_MAX, AllowRule, AllowRules, isSafeAllowRule } from "./allow-rule";

test("allow rules name a tool with an optional pattern and never bypass", () => {
  for (const ok of ["Bash(pnpm *)", "Bash(git *)", "Edit", "WebFetch(domain:github.com)", "Read(~/.kibo/**)"])
    expect(AllowRule.safeParse(ok).success).toBe(true);
  for (const bad of [
    "Bash",
    "Bash(*)",
    "Bash( * )",
    "Bash()",
    "bash(pnpm *)",
    "Read(dangerously)",
    "Bash(--DANGEROUSLY-skip)",
    "Edit(a\nb)",
    "",
  ])
    expect(AllowRule.safeParse(bad).success).toBe(false);
  expect(AllowRules.safeParse(Array.from({ length: ALLOW_MAX + 1 }, () => "Edit")).success).toBe(false);
  fc.assert(
    fc.property(
      fc.string({ maxLength: 60 }),
      (rule) =>
        !AllowRule.safeParse(rule).success ||
        (isSafeAllowRule(rule) && !/dangerously/i.test(rule) && rule !== "Bash"),
    ),
  );
});
