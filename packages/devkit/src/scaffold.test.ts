import { expect, test } from "bun:test";
import { existsSync, lstatSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentManifest } from "@kibo/schema";
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
