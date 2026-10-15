import { expect, test } from "bun:test";
import type { DenialItem, RunState } from "@kibo/schema";
import { allowanceOf, canRelaunch, itemKey, tilde } from "./denial-logic";

const rule: DenialItem = {
  tool: "Bash",
  target: "pnpm test",
  rule: "Bash(pnpm *)",
  addDir: null,
  reason: "ok",
};
const dir: DenialItem = {
  tool: "Read",
  target: "/home/a/x/y.md",
  rule: null,
  addDir: "/home/a/x",
  reason: "ok",
};
const shell: DenialItem = { tool: "Bash", target: "sh -c 'x'", rule: null, addDir: null, reason: "shell" };

test("only checked rules and folders are allowed, everything else is left", () => {
  const all = allowanceOf([rule, dir, shell], new Set([itemKey(rule), itemKey(dir), itemKey(shell)]));
  expect(all).toEqual({ rules: ["Bash(pnpm *)"], addDirs: ["/home/a/x"], left: [shell] });
  expect(allowanceOf([rule, dir, shell], new Set([itemKey(dir)]))).toEqual({
    rules: [],
    addDirs: ["/home/a/x"],
    left: [rule, shell],
  });
});

test("a run is relaunched only while it waits for an answer or once it ended", () => {
  const resumable: RunState[] = ["waiting_input", "done", "failed", "cancelled"];
  expect(resumable.every(canRelaunch)).toBe(true);
  expect(canRelaunch("running")).toBe(false);
  expect(canRelaunch("queued")).toBe(false);
  expect(canRelaunch(null)).toBe(false);
});

test("the home folder is shown as ~", () => {
  expect(tilde("/Users/adam/.claude/skills")).toBe("~/.claude/skills");
  expect(tilde("/home/adam")).toBe("~");
  expect(tilde("/Users/adamx")).toBe("~");
  expect(tilde("/opt/x")).toBe("/opt/x");
});
