import { expect, test } from "bun:test";
import {
  CAPABILITIES,
  Capability,
  capabilitiesOf,
  capabilityIssue,
  capabilityOfPermission,
  capPermission,
  Selection,
} from "./capability";

test("the seven capabilities and their permission names", () => {
  expect([...CAPABILITIES]).toEqual(["webgl", "audio", "fullscreen", "gamepad", "assets", "design", "embed"]);
  expect(Capability.safeParse("network").success).toBe(false);
  expect(capPermission("webgl")).toBe("cap:webgl");
  expect(capabilityOfPermission("cap:assets")).toBe("assets");
  expect(capabilityOfPermission("cap:net")).toBeNull();
  expect(capabilityOfPermission("read:ticket")).toBeNull();
});

test("capabilitiesOf copies the declared list and defaults to none", () => {
  expect(capabilitiesOf({ capabilities: ["audio", "webgl"] })).toEqual(["audio", "webgl"]);
  expect(capabilitiesOf({})).toEqual([]);
});

test("capabilityIssue refuses duplicates and adapters", () => {
  expect(capabilityIssue({ kind: "widget", capabilities: ["webgl", "assets"] })).toBeNull();
  expect(capabilityIssue({ kind: "widget" })).toBeNull();
  expect(capabilityIssue({ kind: "widget", capabilities: ["webgl", "webgl"] })).toBe(
    "INVALID_MANIFEST: capabilities must be unique",
  );
  expect(capabilityIssue({ kind: "adapter", capabilities: ["assets"] })).toBe(
    "INVALID_MANIFEST: an adapter has no capability",
  );
});

test("capabilityIssue ties the embed capability to declared embeds", () => {
  expect(capabilityIssue({ kind: "widget", capabilities: ["embed"] })).toBe(
    "INVALID_MANIFEST: embed needs embeds",
  );
  expect(capabilityIssue({ kind: "widget", capabilities: ["embed"], embeds: [] })).toBe(
    "INVALID_MANIFEST: embed needs embeds",
  );
  expect(capabilityIssue({ kind: "widget", embeds: ["itch.io"] })).toBe(
    "INVALID_MANIFEST: embeds need the embed capability",
  );
  expect(capabilityIssue({ kind: "widget", capabilities: ["embed"], embeds: ["itch.io"] })).toBeNull();
});

test("a selection holds 1 to 200 unique ticket ids", () => {
  expect(Selection.safeParse({ kind: "ticket", ids: ["t1", "t2"] }).success).toBe(true);
  expect(Selection.safeParse({ kind: "ticket", ids: [] }).success).toBe(false);
  expect(Selection.safeParse({ kind: "ticket", ids: ["t1", "t1"] }).success).toBe(false);
  expect(
    Selection.safeParse({ kind: "ticket", ids: Array.from({ length: 201 }, (_, i) => `t${i}`) }).success,
  ).toBe(false);
  expect(Selection.safeParse({ kind: "page", ids: ["p1"] }).success).toBe(false);
});
