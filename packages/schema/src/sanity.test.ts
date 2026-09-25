import { expect, test } from "bun:test";
import { KIBO_SCHEMA_VERSION } from "./index";

test("schema package is wired", () => {
  expect(KIBO_SCHEMA_VERSION).toBe(1);
});
