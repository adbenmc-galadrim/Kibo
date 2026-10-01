import { expect, test } from "bun:test";
import { ComponentManifest, defaultFormatOf, formatIssue, formatsOf } from "./manifest";
import { HostToFrame, surfaceFor } from "./protocol";

const base = { id: "x", version: "1.0.0", title: "X", reads: [], writes: [] };

test("formats are optional and derived from the kind", () => {
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "widget" }))).toEqual([
    "medium",
    "large",
    "half",
  ]);
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "view" }))).toEqual(["full"]);
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "both" }))).toEqual([
    "medium",
    "large",
    "half",
    "full",
  ]);
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "adapter" }))).toEqual([]);
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "both", formats: ["small", "full"] }))).toEqual([
    "small",
    "full",
  ]);
  expect(defaultFormatOf({ kind: "both", formats: ["small", "full"] })).toBe("small");
  expect(defaultFormatOf({ kind: "both", formats: ["full", "large"] })).toBe("large");
  expect(defaultFormatOf({ kind: "view" })).toBe("full");
  expect(defaultFormatOf({ kind: "adapter" })).toBe("half");
  expect(ComponentManifest.safeParse({ ...base, kind: "widget", formats: [] }).success).toBe(false);
  expect(ComponentManifest.safeParse({ ...base, kind: "widget", formats: ["huge"] }).success).toBe(false);
  expect(
    ComponentManifest.safeParse({
      ...base,
      kind: "widget",
      formats: ["small", "medium", "large", "half", "full", "small"],
    }).success,
  ).toBe(false);
});

test("the manifest stays a plain object schema", () => {
  expect(ComponentManifest.shape.formats.isOptional()).toBe(true);
  expect(Object.keys(ComponentManifest.pick({ id: true, version: true }).shape)).toEqual(["id", "version"]);
});

test("formatIssue names the inconsistency", () => {
  expect(formatIssue({ kind: "view", formats: ["large"] })).toMatch(/view.*full/);
  expect(formatIssue({ kind: "widget", formats: ["full"] })).toMatch(/widget/);
  expect(formatIssue({ kind: "both", formats: ["large", "large"] })).toMatch(/unique/);
  expect(formatIssue({ kind: "adapter", formats: ["small"] })).toMatch(/adapter/);
  expect(formatIssue({ kind: "both", formats: ["large", "full"] })).toBeNull();
  expect(formatIssue({ kind: "view", formats: ["full", "half"] })).toBeNull();
  expect(formatIssue({ kind: "widget", formats: ["full", "small"] })).toBeNull();
  expect(formatIssue({ kind: "widget" })).toBeNull();
  expect(formatIssue({ kind: "adapter" })).toBeNull();
});

test("surfaceFor", () => {
  expect(surfaceFor({ kind: "both" }, "full")).toBe("view");
  expect(surfaceFor({ kind: "view" }, "full")).toBe("view");
  expect(surfaceFor({ kind: "widget" }, "full")).toBe("widget");
  expect(surfaceFor({ kind: "both" }, "large")).toBe("widget");
  expect(surfaceFor({ kind: "view" }, "half")).toBe("widget");
});

test("the init message carries the format of the instance", () => {
  const init = {
    kibo: 1,
    type: "init",
    instanceId: "i",
    config: {},
    viewer: "adam",
    theme: "dark",
    surface: "widget",
  };
  expect(HostToFrame.parse({ ...init, format: "large" })).toMatchObject({ format: "large" });
  expect(HostToFrame.safeParse({ ...init, format: "huge" }).success).toBe(false);
});
