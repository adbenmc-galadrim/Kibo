import { expect, test } from "bun:test";
import { TRUST_FORMAT_VERSION } from "./index";

test("trust package is wired", () => {
  expect(TRUST_FORMAT_VERSION).toBe(1);
});
