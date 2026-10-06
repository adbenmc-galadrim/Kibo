import { expect, test } from "bun:test";
import { ConfigField } from "./config";
import { validateConfig } from "./config-validate";

test("a frame field holds a figma or penpot frame url", () => {
  const schema = { frame: { type: "string", nullable: true, default: null, frame: true } } as const;
  expect(validateConfig(schema, { frame: "https://www.figma.com/design/AbC123xyz/K?node-id=1-2" })).toEqual(
    [],
  );
  expect(validateConfig(schema, { frame: null })).toEqual([]);
  expect(validateConfig(schema, { frame: "https://example.com/x" })).toEqual([
    "frame: not a figma or penpot frame url",
  ]);
  expect(ConfigField.safeParse({ type: "number", frame: true }).success).toBe(false);
  expect(ConfigField.safeParse({ type: "string", frame: true }).success).toBe(true);
});

test("an inherited object property is an unknown key", () => {
  const schema = { size: { type: "number", default: 1 } } as const;
  expect(validateConfig(schema, { toString: 1, constructor: "x", size: 2 })).toEqual([
    "toString: unknown key",
    "constructor: unknown key",
  ]);
});
