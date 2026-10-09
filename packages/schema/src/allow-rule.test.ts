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

const refused = (rule: string) => expect(isSafeAllowRule(rule)).toBe(false);

test("the rules planned for Emis stay allowed", () => {
  for (const rule of [
    "Bash(pnpm *)",
    "Bash(git *)",
    "Bash(git push*)",
    "Bash(gh pr *)",
    "Bash(docker compose *)",
    "Bash(npx playwright *)",
    "Bash(npm run test:*)",
    "Bash(shellcheck *)",
  ])
    expect(isSafeAllowRule(rule)).toBe(true);
});

test("a bare star pattern is refused for every tool", () => {
  refused("Read(*)");
  refused("Edit( * )");
  refused("WebFetch(**)");
});

test("a Bash pattern of only stars is refused", () => {
  refused("Bash(**)");
});

test("a Bash pattern that starts with a star is refused", () => {
  refused("Bash(* push)");
  refused("Bash(*sh -c *)");
});

test("a Bash rule that hands the command to a shell is refused", () => {
  for (const shell of ["sh", "bash", "zsh", "dash", "fish", "ksh", "csh", "tcsh", "ash"]) {
    refused(`Bash(${shell} *)`);
    refused(`Bash(${shell} -c *)`);
    refused(`Bash(${shell})`);
  }
});

test("a Bash rule that wraps another command is refused", () => {
  for (const wrapper of [
    "env",
    "exec",
    "eval",
    "xargs",
    "sudo",
    "doas",
    "nohup",
    "command",
    "builtin",
    "nice",
    "timeout",
    "time",
    "source",
    ".",
  ])
    refused(`Bash(${wrapper} *)`);
});

test("a Bash rule that starts with a path to a shell is refused", () => {
  refused("Bash(/bin/sh *)");
  refused("Bash(/usr/bin/env bash *)");
  refused("Bash(./bash -c *)");
});

test("a Bash rule in the legacy colon form is judged by its command", () => {
  refused("Bash(sh:*)");
  refused("Bash(sudo:*)");
});

test("a Bash glob that may name a shell or a wrapper is refused", () => {
  refused("Bash(sh*)");
  refused("Bash(s*)");
  refused("Bash(/bin/*)");
  refused("Bash(e* *)");
});

test("a Bash rule that starts with an assignment is refused", () => {
  refused("Bash(FOO=1 sh -c *)");
  refused("Bash(PATH=* *)");
});

test("a quoted or escaped first word is refused", () => {
  for (const rule of ['Bash("sh" *)', "Bash('bash' -c *)", "Bash(\\sh *)", 'Bash("env" *)', "Bash(g'i't *)"])
    refused(rule);
});

test("glob characters other than a final star are refused in the first word", () => {
  for (const rule of ["Bash(?ash *)", "Bash(ba[s]h *)", "Bash(E?V *)", "Bash(g*t push)", "Bash(git{,x} *)"])
    refused(rule);
});

test("an empty command name is refused", () => {
  refused("Bash(:*)");
  refused("Bash(./ *)");
});

test("shell and wrapper names are compared without case", () => {
  for (const rule of ["Bash(BASH *)", "Bash(Sh -c *)", "Bash(ENV *)", "Bash(/BIN/ZSH *)", "Bash(SU*)"])
    refused(rule);
});
