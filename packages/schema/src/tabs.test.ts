import { expect, test } from "bun:test";
import { Screen, TabTarget } from "./tabs";

test("creations is a screen a tab can open", () => {
  expect(Screen.parse("creations")).toBe("creations");
  expect(TabTarget.parse({ kind: "screen", screen: "creations" })).toEqual({
    kind: "screen",
    screen: "creations",
  });
});
