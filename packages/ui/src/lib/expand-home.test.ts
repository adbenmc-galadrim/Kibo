import { expect, test } from "bun:test";
import { expandHome, tildify } from "./expand-home";

test("a leading tilde becomes the home folder", () => {
  expect(expandHome("~", "/Users/adam")).toBe("/Users/adam");
  expect(expandHome("~/.claude/skills", "/Users/adam")).toBe("/Users/adam/.claude/skills");
  expect(expandHome("  ~/Documents/silo  ", "/Users/adam")).toBe("/Users/adam/Documents/silo");
});

test("any other path is kept as typed", () => {
  expect(expandHome("/opt/x", "/Users/adam")).toBe("/opt/x");
  expect(expandHome("~bob/x", "/Users/adam")).toBe("~bob/x");
  expect(expandHome("docs/~/x", "/Users/adam")).toBe("docs/~/x");
});

test("a path under the home folder is shown with a tilde", () => {
  expect(tildify("/Users/adam/.claude/skills", "/Users/adam")).toBe("~/.claude/skills");
  expect(tildify("/Users/adam", "/Users/adam")).toBe("~");
  expect(tildify("/Users/adamo/x", "/Users/adam")).toBe("/Users/adamo/x");
  expect(tildify("/Users/adam/x", null)).toBe("/Users/adam/x");
});
