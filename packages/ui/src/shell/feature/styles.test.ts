import { expect, test } from "bun:test";
import { STEP_CIRCLE } from "./styles";

test("a filled step marker reads its number through the on-fill token", () => {
  for (const fill of Object.values(STEP_CIRCLE)) {
    expect(fill).toContain("text-(--tracking-on-fill)");
    expect(fill).not.toContain("text-white");
  }
});
