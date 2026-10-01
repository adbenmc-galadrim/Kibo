import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold, validateComponent } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { COMPONENT_FORMATS } from "@kibo/schema";
import { EXAMPLE_COMPONENT } from "./prompts-skill";

setDefaultTimeout(180_000);
const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

test("the example given to the agent passes the validation in every format", async () => {
  const root = mkdtempSync(join(tmpdir(), "kibo-example-"));
  roots.push(root);
  const dir = await scaffold({ root, id: "exemple", kind: "both", server: false, toolchain: DEV_TOOLCHAIN });
  const manifestFile = join(dir, "kibo.component.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  writeFileSync(
    manifestFile,
    JSON.stringify({ ...manifest, reads: ["ticket", "status"], formats: [...COMPONENT_FORMATS] }),
  );
  writeFileSync(join(dir, "ui.tsx"), EXAMPLE_COMPONENT);
  const report = await validateComponent(dir, { toolchain: DEV_TOOLCHAIN });
  expect({
    typecheck: report.typecheck.errors,
    imports: report.imports.errors,
    tests: report.tests.ok ? "" : report.tests.output,
    conformance: report.conformance.errors,
    permissions: report.permissions.missing,
  }).toEqual({ typecheck: [], imports: [], tests: "", conformance: [], permissions: [] });
  expect(report.permissions.unused).toEqual([]);
  expect(report.ok).toBe(true);
});
