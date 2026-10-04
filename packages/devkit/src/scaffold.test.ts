import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentManifest, type Template } from "@kibo/schema";
import { scaffold } from "./scaffold";
import { DEV_TOOLCHAIN } from "./test-kit";

test("new creates a valid 0.1.0 component with its conformance test", async () => {
  const root = mkdtempSync(join(tmpdir(), "kibo-scaffold-"));
  const dir = await scaffold({
    root,
    id: "burndown",
    kind: "widget",
    server: true,
    toolchain: DEV_TOOLCHAIN,
  });
  expect(dir).toBe(join(root, "burndown"));
  const manifest = ComponentManifest.parse(
    JSON.parse(readFileSync(join(dir, "kibo.component.json"), "utf8")),
  );
  expect(manifest).toMatchObject({
    id: "burndown",
    version: "0.1.0",
    kind: "widget",
    title: "Burndown",
    reads: [],
    writes: [],
  });
  for (const f of ["ui.tsx", "server.ts", "component.test.tsx", "tsconfig.json"]) {
    expect(existsSync(join(dir, f))).toBe(true);
  }
  expect(readFileSync(join(dir, "component.test.tsx"), "utf8")).toContain("runConformance");
  expect(readFileSync(join(dir, "ui.tsx"), "utf8")).toContain(
    '<CardContent className="flex min-h-0 flex-1 flex-col text-sm text-muted-foreground">',
  );
  expect(lstatSync(join(dir, "node_modules")).isSymbolicLink()).toBe(true);
});

test("new refuses an existing folder, a built-in id and an invalid id", async () => {
  const root = mkdtempSync(join(tmpdir(), "kibo-scaffold-"));
  const opts = { root, kind: "both" as const, server: false, toolchain: DEV_TOOLCHAIN };
  await scaffold({ ...opts, id: "x-y" });
  await expect(scaffold({ ...opts, id: "x-y" })).rejects.toThrow("INVALID_INPUT");
  await expect(scaffold({ ...opts, id: "kanban" })).rejects.toThrow("INVALID_INPUT");
  await expect(scaffold({ ...opts, id: "Bad Id" })).rejects.toThrow("INVALID_INPUT");
  expect(existsSync(join(root, "x-y", "server.ts"))).toBe(false);
});

describe("templates write their manifest", () => {
  const manifestOf = async (template: Template) => {
    const root = mkdtempSync(join(tmpdir(), "kibo-scaffold-"));
    const opts = { root, id: "demo", kind: "widget" as const, server: false, toolchain: DEV_TOOLCHAIN };
    const dir = await scaffold({ ...opts, template });
    return ComponentManifest.parse(JSON.parse(readFileSync(join(dir, "kibo.component.json"), "utf8")));
  };

  test("3d asks for webgl and assets and a model field", async () => {
    const manifest = await manifestOf("3d");
    expect(manifest.capabilities).toEqual(["webgl", "assets"]);
    expect(manifest.configSchema?.model?.asset).toBe("model");
  });

  test("game asks for fullscreen and gamepad and keeps data", async () => {
    const manifest = await manifestOf("game");
    expect(manifest.capabilities).toEqual(["fullscreen", "gamepad"]);
    expect(manifest.data).toBe(true);
  });

  test("chart and table read tickets and statuses", async () => {
    for (const template of ["chart", "table"] as const) {
      const manifest = await manifestOf(template);
      expect(manifest.reads).toEqual(["ticket", "status"]);
      expect(manifest.capabilities).toEqual([]);
    }
  });

  test("blank is the default card", async () => {
    const write = (template?: Template) =>
      scaffold({
        root: mkdtempSync(join(tmpdir(), "kibo-scaffold-")),
        id: "demo",
        kind: "widget",
        server: false,
        toolchain: DEV_TOOLCHAIN,
        ...(template ? { template } : {}),
      });
    const [implicit, blank] = await Promise.all([write(), write("blank")]);
    for (const f of ["ui.tsx", "kibo.component.json"]) {
      expect(readFileSync(join(blank, f), "utf8")).toBe(readFileSync(join(implicit, f), "utf8"));
    }
    expect(readFileSync(join(blank, "ui.tsx"), "utf8")).toContain("CardTitle");
  });
});
