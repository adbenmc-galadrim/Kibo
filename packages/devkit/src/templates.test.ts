import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Template } from "@kibo/schema";
import { scaffold } from "./scaffold";
import { DEV_TOOLCHAIN } from "./test-kit";
import { validateComponent } from "./validate";

describe("every template scaffolds a component that passes validation", () => {
  for (const template of Template.options) {
    test(template, async () => {
      const root = mkdtempSync(join(tmpdir(), `kibo-tpl-${template}-`));
      const dir = await scaffold({
        root,
        id: `demo-${template}`,
        kind: "widget",
        server: false,
        toolchain: DEV_TOOLCHAIN,
        template,
      });
      const report = await validateComponent(dir, { toolchain: DEV_TOOLCHAIN });
      expect(report.permissions.missing).toEqual([]);
      expect(report.ok).toBe(true);
    }, 240_000);
  }
});
