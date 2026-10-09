import { expect, test } from "bun:test";
import {
  ComponentManifest,
  clampSize,
  defaultFormatOf,
  formatIssue,
  formatsOf,
  sizeIssue,
  sizeLimitsOf,
} from "./manifest";
import { HostToFrame } from "./protocol";
import { surfaceFor } from "./surface";

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

test("size is optional, bounded, and gives limits with defaults", () => {
  const widget = { ...base, kind: "widget" };
  expect(ComponentManifest.safeParse({ ...widget, size: { min: { w: 4, h: 3 } } }).success).toBe(true);
  expect(ComponentManifest.safeParse({ ...widget, size: { min: { w: 0, h: 3 } } }).success).toBe(false);
  expect(ComponentManifest.safeParse({ ...widget, size: { max: { w: 13, h: 3 } } }).success).toBe(false);
  expect(sizeLimitsOf({})).toEqual({ min: { w: 2, h: 2 }, max: { w: 12, h: 12 } });
  expect(sizeLimitsOf({ size: { min: { w: 6, h: 4 } } })).toEqual({
    min: { w: 6, h: 4 },
    max: { w: 12, h: 12 },
  });
  expect(clampSize({ w: 1, h: 40 }, sizeLimitsOf({ size: { min: { w: 6, h: 4 } } }))).toEqual({
    w: 6,
    h: 12,
  });
});

test("sizeIssue refuses min above max and a declared format outside the limits", () => {
  expect(sizeIssue({ kind: "widget", size: { min: { w: 6, h: 6 }, max: { w: 4, h: 4 } } })).toMatch(
    /INVALID_MANIFEST/,
  );
  expect(sizeIssue({ kind: "widget", formats: ["small"], size: { min: { w: 6, h: 4 } } })).toMatch(/small/);
  expect(sizeIssue({ kind: "widget", formats: ["large", "half"], size: { min: { w: 6, h: 4 } } })).toBeNull();
  expect(sizeIssue({ kind: "widget" })).toBeNull();
});

test("capabilities and selection are optional manifest fields", () => {
  const m = ComponentManifest.parse({
    id: "v",
    version: "0.1.0",
    kind: "widget",
    title: "V",
    reads: [],
    writes: [],
  });
  expect(m.capabilities).toEqual([]);
  expect(m.selection).toBe(false);
  const rich = ComponentManifest.parse({ ...m, capabilities: ["webgl", "assets"], selection: true });
  expect(rich.capabilities).toEqual(["webgl", "assets"]);
  expect(ComponentManifest.safeParse({ ...m, capabilities: ["network"] }).success).toBe(false);
});

test("embeds are exact lowercase hosts, empty by default", () => {
  const m = ComponentManifest.parse({ ...base, kind: "widget" });
  expect(m.embeds).toEqual([]);
  expect(ComponentManifest.parse({ ...m, embeds: ["itch.io"] }).embeds).toEqual(["itch.io"]);
  for (const host of ["ITCH.IO", "itch.io/", "localhost", "https://itch.io", "*.itch.io"]) {
    expect(ComponentManifest.safeParse({ ...m, embeds: [host] }).success).toBe(false);
  }
});
