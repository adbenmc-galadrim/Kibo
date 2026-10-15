import { expect, test } from "bun:test";
import { expandHome } from "./expand-home";

test("a leading tilde becomes the home folder", () => {
  expect(expandHome("~", "/Users/adam")).toBe("/Users/adam");
  expect(expandHome("~/.claude/skills", "/Users/adam")).toBe("/Users/adam/.claude/skills");
  expect(expandHome("  ~/Documents/emis  ", "/Users/adam")).toBe("/Users/adam/Documents/emis");
});

test("any other path is kept as typed", () => {
  expect(expandHome("/opt/x", "/Users/adam")).toBe("/opt/x");
  expect(expandHome("~bob/x", "/Users/adam")).toBe("~bob/x");
  expect(expandHome("docs/~/x", "/Users/adam")).toBe("docs/~/x");
});
