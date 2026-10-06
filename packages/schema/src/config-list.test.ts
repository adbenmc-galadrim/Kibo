import { expect, test } from "bun:test";
import { ConfigField, FRAME_LIST_MAX, frameList, validateConfig } from "./index";

const FIGMA = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const PENPOT =
  "https://design.penpot.app/#/view/33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";
const schema = { frame: { type: "string" as const, frame: true as const, list: true as const, default: [] } };

test("a list field is a frame field", () => {
  expect(ConfigField.safeParse({ type: "string", list: true }).success).toBe(false);
  expect(ConfigField.safeParse({ type: "number", frame: true, list: true }).success).toBe(false);
  expect(ConfigField.safeParse({ type: "string", frame: true, list: true, default: [] }).success).toBe(true);
});

test("a frame list accepts valid urls, a legacy scalar and null", () => {
  expect(validateConfig(schema, { frame: [FIGMA, PENPOT] })).toEqual([]);
  expect(validateConfig(schema, { frame: FIGMA })).toEqual([]);
  expect(validateConfig(schema, { frame: null })).toEqual([]);
  expect(validateConfig(schema, { frame: [] })).toEqual([]);
  expect(validateConfig(schema, { frame: [FIGMA, "https://example.com"] })).toEqual([
    "frame: not a figma or penpot frame url",
  ]);
  expect(validateConfig(schema, { frame: [FIGMA, 4] })).toEqual(["frame: not a figma or penpot frame url"]);
  expect(validateConfig(schema, { frame: 3 })).toEqual(["frame: expected a list of frame urls"]);
  expect(validateConfig(schema, { frame: Array<string>(FRAME_LIST_MAX + 1).fill(FIGMA) })).toEqual([
    `frame: more than ${FRAME_LIST_MAX} frames`,
  ]);
});

test("frameList reads a list, a legacy string or nothing", () => {
  expect(frameList([` ${FIGMA} `, "", 4, PENPOT, "   "])).toEqual([FIGMA, PENPOT]);
  expect(frameList(FIGMA)).toEqual([FIGMA]);
  expect(frameList("  ")).toEqual([]);
  expect(frameList(null)).toEqual([]);
  expect(frameList(undefined)).toEqual([]);
});
