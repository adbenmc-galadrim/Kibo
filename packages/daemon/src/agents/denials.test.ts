import { expect, test } from "bun:test";
import { actionOf, type RunAction } from "@kibo/schema";
import { denialsOfTurn, refusedActions } from "./denials";
import { CLAUDE_DENIAL_TEXT } from "./fake-claude-transcript";

const HOME = "/Users/dev";
const CTX = {
  home: HOME,
  cwd: `${HOME}/Documents/silo-feat-15`,
  known: [`${HOME}/.claude/skills`],
  allowed: [],
  addDirs: [],
};
const KIBO_TEXT = "Permission to use Skill has been denied. skill non autorisé par Kibo : deploy";

const refused = (tool: string, input: Record<string, unknown>, output = CLAUDE_DENIAL_TEXT): RunAction =>
  actionOf({ tool, input, output, isError: true, denied: true, patch: null });
const ok = (tool: string, input: Record<string, unknown>): RunAction =>
  actionOf({ tool, input, output: "ok", isError: false, denied: false, patch: null });

const SILO_15: RunAction[] = [
  ok("Read", { file_path: `${HOME}/Documents/silo-feat-15/src/app.ts` }),
  refused("Bash", { command: "cd apps/api && pnpm test 2>&1 | tail -40" }),
  refused("Read", { file_path: `${HOME}/.claude/skills/full-delivery/reference/kibo.md` }),
  refused("Bash", { command: 'git commit -m "feat: export" && git push' }),
  refused("Bash", { command: 'sh -c "rm -rf dist"' }),
  refused("Skill", { skill: "deploy" }, KIBO_TEXT),
  refused("mcp__kibo__peek_work", { run: "SILO-12" }),
  ok("Bash", { command: "ls" }),
];

test("Claude Code refusals of a turn become proposals, Kibo refusals are ignored", () => {
  expect(refusedActions(SILO_15, [])).toHaveLength(5);
  expect(denialsOfTurn(SILO_15, [], CTX)).toEqual([
    { tool: "Bash", target: "cd apps/api", rule: "Bash(cd *)", addDir: null, reason: "ok" },
    { tool: "Bash", target: "pnpm test 2>&1", rule: "Bash(pnpm *)", addDir: null, reason: "ok" },
    { tool: "Bash", target: "tail -40", rule: "Bash(tail *)", addDir: null, reason: "ok" },
    {
      tool: "Read",
      target: `${HOME}/.claude/skills/full-delivery/reference/kibo.md`,
      rule: null,
      addDir: `${HOME}/.claude/skills`,
      reason: "ok",
    },
    { tool: "Bash", target: 'git commit -m "feat: export"', rule: "Bash(git *)", addDir: null, reason: "ok" },
    { tool: "Bash", target: 'sh -c "rm -rf dist"', rule: null, addDir: null, reason: "shell" },
    { tool: "mcp__kibo__peek_work", target: "peek_work", rule: null, addDir: null, reason: "mcp" },
  ]);
});

test("rules and folders already allowed on the agent or the project are left out", () => {
  const items = denialsOfTurn(SILO_15, [], {
    ...CTX,
    allowed: ["Bash(pnpm *)", "Bash(git *)"],
    addDirs: [`${HOME}/.claude`],
  });
  expect(items.map((i) => i.rule ?? i.addDir ?? i.reason)).toEqual([
    "Bash(cd *)",
    "Bash(tail *)",
    "shell",
    "mcp",
  ]);
});

test("a turn without Claude Code refusal proposes nothing", () => {
  const kiboOnly = [refused("Skill", { skill: "deploy" }, KIBO_TEXT), ok("Bash", { command: "ls" })];
  expect(denialsOfTurn(kiboOnly, ["Skill"], CTX)).toEqual([]);
  expect(denialsOfTurn([], ["Bash"], CTX)).toEqual([]);
});

test("a refusal folded as an error still counts when the result names the tool", () => {
  const failed = actionOf({
    tool: "Bash",
    input: { command: "pnpm lint" },
    output: CLAUDE_DENIAL_TEXT,
    isError: true,
    denied: false,
    patch: null,
  });
  expect(denialsOfTurn([failed], [], CTX)).toEqual([]);
  expect(denialsOfTurn([failed], ["Bash"], CTX).map((i) => i.rule)).toEqual(["Bash(pnpm *)"]);
});
