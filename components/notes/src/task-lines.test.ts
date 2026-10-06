import { expect, test } from "bun:test";
import { toggleTaskLine } from "./task-lines";

test("toggleTaskLine flips the marker of that line only", () => {
  const md = "# T\n\n- [x] a\n- [ ] b\n1. [ ] c\n";
  expect(toggleTaskLine(md, 2)).toBe("# T\n\n- [ ] a\n- [ ] b\n1. [ ] c\n");
  expect(toggleTaskLine(md, 3)).toBe("# T\n\n- [x] a\n- [x] b\n1. [ ] c\n");
  expect(toggleTaskLine(md, 4)).toBe("# T\n\n- [x] a\n- [ ] b\n1. [x] c\n");
  expect(toggleTaskLine("  - [X] indentée", 0)).toBe("  - [ ] indentée");
  expect(toggleTaskLine(md, 0)).toBeNull();
  expect(toggleTaskLine(md, 99)).toBeNull();
});
