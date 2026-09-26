import { afterAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileCss } from "../tailwind";
import { REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-d-");
afterAll(tmp.dispose);

test("tailwind compiles only the classes used by a folder outside the monorepo", async () => {
  writeFileSync(join(tmp.dir, "ui.tsx"), 'export const A = () => <p className="bg-emerald-500 p-3">a</p>;\n');
  const css = await compileCss({
    css: '@import "tailwindcss";',
    sources: [tmp.dir],
    toolchain: { root: REPO },
  });
  expect(css).toContain(".bg-emerald-500");
  expect(css).toContain(".p-3");
  expect(css).not.toContain(".bg-rose-500");
}, 30_000);
