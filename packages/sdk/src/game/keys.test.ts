import { expect, test } from "bun:test";
import { GAME_KEYS, keysReducer } from "./keys";

test("keys are tracked by code and cleared on blur", () => {
  let s = keysReducer(new Set(), { type: "keydown", code: "ArrowLeft" });
  s = keysReducer(s, { type: "keydown", code: "Space" });
  expect([...s]).toEqual(["ArrowLeft", "Space"]);
  s = keysReducer(s, { type: "keyup", code: "ArrowLeft" });
  expect([...s]).toEqual(["Space"]);
  expect([...keysReducer(s, { type: "blur", code: "" })]).toEqual([]);
  expect(GAME_KEYS).toEqual(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
});
