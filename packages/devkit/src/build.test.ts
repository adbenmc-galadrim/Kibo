import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildComponent } from "./build";

const repo = resolve(import.meta.dir, "../../..");
const toolchain = { root: repo };
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function component(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "kibo-build-"));
  roots.push(root);
  const dir = join(root, "hello");
  mkdirSync(dir);
  for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
  symlinkSync(join(repo, "node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}

const manifest = JSON.stringify({
  id: "hello",
  version: "0.1.0",
  kind: "both",
  title: "Hello",
  reads: ["ticket"],
  writes: [],
});
const ui = `import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
export function Component() {
  const sdk = useSdk();
  return <Button className="bg-emerald-500"><Plus />{sdk.viewer}</Button>;
}
`;

test("builds sandbox, trusted and css outputs from the sources", async () => {
  const out = await buildComponent(component({ "kibo.component.json": manifest, "ui.tsx": ui }), toolchain);
  expect(out.manifest.id).toBe("hello");
  expect(Object.keys(out.files).sort()).toEqual(["ui.css", "ui.sandbox.js", "ui.trusted.js"]);
  const trusted = new TextDecoder().decode(out.files["ui.trusted.js"]);
  expect(trusted).toContain("__kiboShared");
  expect(trusted).not.toContain("react.production");
  expect(trusted).not.toContain("react.transitional.element");
  const sandbox = new TextDecoder().decode(out.files["ui.sandbox.js"]);
  expect(sandbox.length).toBeGreaterThan(trusted.length * 5);
  const css = new TextDecoder().decode(out.files["ui.css"]);
  expect(css).toContain(".bg-emerald-500");
  expect(css).toContain(".dark");
}, 60_000);

test("server and migrations are CommonJS bundles", async () => {
  const out = await buildComponent(
    component({
      "kibo.component.json": manifest,
      "ui.tsx": ui,
      "server.ts": `import { defineServer } from "@kibo/sdk/server";\nexport const server = defineServer({ actions: { ping: async () => "pong" } });\n`,
      "migrations.ts": `import { defineMigrations } from "@kibo/sdk/migrations";\nexport const migrations = defineMigrations({ 1: { config: (c) => ({ ...c, v: 1 }) } });\n`,
    }),
    toolchain,
  );
  const server = new TextDecoder().decode(out.files["server.js"]);
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function("module", "exports", server)(mod, mod.exports);
  expect(typeof mod.exports.server).toBe("object");
  expect(out.files["migrations.js"]).toBeDefined();
}, 60_000);

test("a forbidden import fails the build", async () => {
  const bad = component({
    "kibo.component.json": manifest,
    "ui.tsx": `import fs from "node:fs";\nexport const Component = () => String(fs);\n`,
  });
  await expect(buildComponent(bad, toolchain)).rejects.toThrow("VALIDATION_FAILED");
}, 60_000);

test("a relative import outside the component fails the build", async () => {
  const bad = component({
    "kibo.component.json": manifest,
    "ui.tsx": `import { x } from "../outside";\nexport const Component = () => <p>{x}</p>;\n`,
  });
  await expect(buildComponent(bad, toolchain)).rejects.toThrow("import outside the component");
}, 60_000);

test("a macro never runs at build time", async () => {
  const marker = join(mkdtempSync(join(tmpdir(), "kibo-macro-")), "ran");
  roots.push(dirname(marker));
  const dir = component({
    "kibo.component.json": manifest,
    "m.ts": `import { writeFileSync } from "node:fs";\nexport function pwn() { writeFileSync(${JSON.stringify(marker)}, "x"); return 1; }\n`,
    "ui.tsx": `import { pwn } from "./m.ts" with { type: "macro" };\nexport const Component = () => <p>{pwn()}</p>;\n`,
  });
  await expect(buildComponent(dir, toolchain)).rejects.toThrow("VALIDATION_FAILED");
  expect(existsSync(marker)).toBe(false);
}, 60_000);
