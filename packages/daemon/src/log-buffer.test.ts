import { expect, test } from "bun:test";
import { createLogBuffer } from "./log-buffer";

test("the buffer keeps the last lines and leaves the console output untouched", () => {
  const seen: string[] = [];
  const target = {
    error: (...a: unknown[]) => seen.push(`E${a.join(" ")}`),
    warn: (...a: unknown[]) => seen.push(`W${a.join(" ")}`),
  };
  const buffer = createLogBuffer(3);
  const off = buffer.install(target);
  target.error("one", 1);
  target.warn("two");
  target.error("three");
  target.error(new Error("four"));
  expect(seen).toEqual(["Eone 1", "Wtwo", "Ethree", "EError: four"]);
  expect(buffer.tail(10)).toEqual(["warn two", "error three", "error Error: four"]);
  expect(buffer.tail(1)).toEqual(["error Error: four"]);
  off();
  target.error("five");
  expect(buffer.tail(10)).toHaveLength(3);
});

test("a value that cannot be serialised is still recorded", () => {
  const target = { error: (..._args: unknown[]) => undefined, warn: (..._args: unknown[]) => undefined };
  const buffer = createLogBuffer();
  buffer.install(target);
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  target.error("cyclic", loop, undefined);
  expect(buffer.tail(1)[0]).toMatch(/^error cyclic \[unserializable: .+\] undefined$/);
});
