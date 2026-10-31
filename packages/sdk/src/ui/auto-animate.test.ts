import { expect, test } from "bun:test";
import { useAutoAnimate } from "@kibo/sdk/ui/auto-animate";

test("the SDK exposes useAutoAnimate", () => {
  expect(typeof useAutoAnimate).toBe("function");
});
