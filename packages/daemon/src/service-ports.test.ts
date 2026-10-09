import { expect, test } from "bun:test";
import { portSlot, ready } from "./service-ports";

test("a slot holds the attached port until it is detached", () => {
  const slot = portSlot<{ name: string }>();
  expect(slot.get()).toBeNull();
  const detach = slot.attach({ name: "ai" });
  expect(slot.get()).toEqual({ name: "ai" });
  detach();
  expect(slot.get()).toBeNull();
});

test("a missing port is refused with the given code", () => {
  expect(ready("port", "INTERNAL", "not ready")).toBe("port");
  expect(() => ready(null, "AI_UNAVAILABLE", "the AI is not started")).toThrow(
    expect.objectContaining({ code: "AI_UNAVAILABLE" }),
  );
});
