import { expect, test } from "bun:test";
import { isCompiled } from "./compiled";

test("the daemon run from its sources is not a compiled binary", () => {
  expect(isCompiled()).toBe(false);
});
