import { expect, test } from "bun:test";
import fc from "fast-check";
import { isSafeAddDir } from "./add-dir";
import { isSafeAllowRule } from "./allow-rule";
import { DENIAL_ITEMS_MAX, proposeRules } from "./denial";

const HOME = "/Users/a";
const CTX = { home: HOME, cwd: `${HOME}/work`, known: [`${HOME}/.claude/skills`, "/opt/shared"] };
const WORDS = ["git", "pnpm", "sh", "env", "xargs", "FOO=1", "cd", "/bin/rm", "a*", "'q'", "$(x)", "`y`"];
const OPERATORS = [" && ", " || ", "; ", " | ", "\n", " "];
const command = fc
  .array(
    fc.tuple(fc.oneof(fc.constantFrom(...WORDS), fc.string({ maxLength: 8 })), fc.constantFrom(...OPERATORS)),
    {
      maxLength: 8,
    },
  )
  .map((parts) => parts.map(([w, op]) => `${w}${op}`).join(""));
const SEGMENTS = ["..", ".claude", "skills", ".ssh", ".kibo", "work", "x", "~", ""];
const path = fc
  .tuple(
    fc.constantFrom("/", `${HOME}/`, "~/", "", "/opt/"),
    fc.array(fc.constantFrom(...SEGMENTS), { maxLength: 5 }),
  )
  .map(([head, parts]) => `${head}${parts.join("/")}`);
const TOOLS = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "LS",
  "Edit",
  "WebFetch",
  "WebSearch",
  "mcp__kibo__x",
  "Other",
];
const action = fc.record({
  tool: fc.constantFrom(...TOOLS),
  target: fc.option(fc.oneof(command, path, fc.webUrl()), { nil: null }),
});

test("every proposal is a safe rule or a safe folder, and there are at most twenty", () => {
  fc.assert(
    fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
      const items = proposeRules(actions, CTX);
      expect(items.length).toBeLessThanOrEqual(DENIAL_ITEMS_MAX);
      for (const item of items) {
        if (item.rule !== null) expect(isSafeAllowRule(item.rule)).toBe(true);
        if (item.addDir !== null) {
          expect(item.addDir.startsWith(`${HOME}/`)).toBe(true);
          expect(isSafeAddDir(item.addDir, HOME)).toBe(true);
        }
        expect(item.reason === "ok").toBe(item.rule !== null || item.addDir !== null);
      }
    }),
    { numRuns: 500 },
  );
});
