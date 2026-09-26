import { expect, test } from "bun:test";
import { checkImports } from "./imports";
import { DEV_TOOLCHAIN } from "./test-kit";
import { loadTypeScript } from "./typescript";

const ts = await loadTypeScript(DEV_TOOLCHAIN);
const codes = (path: string, text: string) =>
  checkImports(ts, [{ path, text }]).map((i) => `${i.code}:${i.detail}`);

test("shared modules and relative paths are allowed", () => {
  const text = `import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import manifest from "./kibo.component.json";
import { helper } from "./lib/helper";
export { manifest, helper, useSdk, Button, Plus, useState };`;
  expect(codes("ui.tsx", text)).toEqual([]);
});

test("anything else is refused, with the file and the line", () => {
  expect(codes("ui.tsx", 'import fs from "node:fs";')).toEqual(["forbidden-import:node:fs"]);
  expect(codes("ui.tsx", 'import x from "lodash";')).toEqual(["forbidden-import:lodash"]);
  expect(codes("ui.tsx", 'import { x } from "../outside";')).toEqual(["outside-import:../outside"]);
  expect(codes("ui.tsx", 'export * from "bun";')).toEqual(["forbidden-import:bun"]);
  expect(checkImports(ts, [{ path: "ui.tsx", text: '\n\nimport x from "zod";' }])[0]?.line).toBe(3);
});

test("test-only and server-only modules are allowed where they belong", () => {
  expect(codes("component.test.tsx", 'import { runConformance } from "@kibo/sdk/conformance";')).toEqual([]);
  expect(codes("ui.tsx", 'import { runConformance } from "@kibo/sdk/conformance";')).toEqual([
    "forbidden-import:@kibo/sdk/conformance",
  ]);
  expect(codes("server.ts", 'import { defineServer } from "@kibo/sdk/server";')).toEqual([]);
});

test("dynamic loading and escape hatches are refused", () => {
  expect(codes("ui.tsx", "const m = await import(name);")).toEqual(["non-literal-import:import(name)"]);
  expect(codes("ui.tsx", 'const m = await import("node:fs");')).toEqual(["forbidden-import:node:fs"]);
  expect(codes("ui.tsx", 'require("fs");')).toContain("banned-identifier:require");
  expect(codes("ui.tsx", 'eval("1");')).toContain("banned-identifier:eval");
  expect(codes("ui.tsx", 'new Function("return 1");')).toContain("banned-identifier:Function");
  expect(codes("ui.tsx", "process.exit(1);")).toContain("banned-identifier:process");
  expect(codes("ui.tsx", "Bun.spawn([]);")).toContain("banned-identifier:Bun");
  expect(codes("ui.tsx", "console.log(import.meta.url);")).toContain("banned-identifier:import.meta");
  expect(codes("ui.tsx", "const o = { process: 1, eval: 2 }; o.process;")).toEqual([]);
});

test("macros, import attributes and worker escapes are refused", () => {
  expect(codes("ui.tsx", 'import { m } from "./m" with { type: "macro" };')).toEqual([
    "banned-identifier:import attributes",
  ]);
  expect(codes("ui.tsx", 'export { m } from "./m" with { type: "macro" };')).toEqual([
    "banned-identifier:import attributes",
  ]);
  expect(codes("ui.tsx", 'const m = await import("./m", { with: { type: "macro" } });')).toEqual([
    "banned-identifier:import attributes",
  ]);
  expect(codes("server.ts", "new Worker(url);")).toContain("banned-identifier:Worker");
  expect(codes("server.ts", "global.fetch;")).toContain("banned-identifier:global");
  expect(codes("server.ts", "self.postMessage(1);")).toContain("banned-identifier:self");
});
