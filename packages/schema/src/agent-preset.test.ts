import { expect, test } from "bun:test";
import { DEFAULT_AGENT_SETTINGS } from "./agent";
import { AGENT_PRESET_IDS, applyPreset, DELIVERY_ALLOW_DEFAULTS, presetPatch } from "./agent-preset";
import { isSafeAllowRule } from "./allow-rule";

test("the delivery preset unblocks a delivery run", () => {
  expect(AGENT_PRESET_IDS).toEqual(["delivery"]);
  const patch = presetPatch("delivery", "/Users/a");
  expect(patch.permissionMode).toBe("auto");
  expect(patch.allSubagents).toBe(true);
  expect(patch.workspace).toBe("worktree");
  expect(patch.skills).toEqual({ mode: "all" });
  expect(patch.addDirs).toEqual(["/Users/a/.claude/skills"]);
  expect(patch.allow).toContain("Bash(pnpm *)");
  expect(patch.allow).toContain("Bash(kibo *)");
  expect(patch.allow).toContain("Bash(gh pr create --draft*)");
});

test("every default delivery rule is a safe rule", () => {
  expect(DELIVERY_ALLOW_DEFAULTS).toHaveLength(16);
  for (const rule of DELIVERY_ALLOW_DEFAULTS) expect(isSafeAllowRule(rule)).toBe(true);
});

test("applying a preset merges rules and folders and keeps the other settings", () => {
  const current = {
    ...DEFAULT_AGENT_SETTINGS,
    allow: ["Bash(make *)", "Bash(pnpm *)"],
    addDirs: ["/Users/a/.claude/skills"],
    maxParallel: 3,
    subagents: ["global:reviewer"],
    enabled: false,
  };
  const next = applyPreset(current, presetPatch("delivery", "/Users/a"));
  expect(next.allow).toEqual([
    "Bash(make *)",
    "Bash(pnpm *)",
    ...DELIVERY_ALLOW_DEFAULTS.filter((r) => r !== "Bash(pnpm *)"),
  ]);
  expect(new Set(next.allow).size).toBe(next.allow.length);
  expect(next.addDirs).toEqual(["/Users/a/.claude/skills"]);
  expect(next.maxParallel).toBe(3);
  expect(next.subagents).toEqual(["global:reviewer"]);
  expect(next.enabled).toBe(false);
  expect(next.permissionMode).toBe("auto");
  expect(next.allSubagents).toBe(true);
});

test("a merge beyond fifty rules is refused", () => {
  const allow = Array.from({ length: 45 }, (_, i) => `Bash(tool${i} *)`);
  expect(() =>
    applyPreset({ ...DEFAULT_AGENT_SETTINGS, allow }, presetPatch("delivery", "/Users/a")),
  ).toThrow("INVALID_INPUT");
});
