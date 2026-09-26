import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isHashedSource, sourceHash, utf8 } from "@kibo/trust";
import { hashFiles, hashSources, isHashed } from "./hash";

const PINNED = "d0ff99004f9199a8d7c83abdc1eff23c0ea689f78e75565200fb629a78afc852";

const dir = mkdtempSync(join(tmpdir(), "kibo-hash-"));
mkdirSync(join(dir, "lib"));
const content: Record<string, string> = {
  "kibo.component.json": '{"id":"burndown"}',
  "ui.tsx": "export const A = 1;\n",
  "lib/chart.ts": "export const B = 2;\n",
  "ui.css": ".a{}\n",
  "component.test.tsx": "x",
};
for (const [path, text] of Object.entries(content)) writeFileSync(join(dir, path), text);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("hashSources is unchanged by the delegation", async () => {
  expect(await hashSources(dir)).toBe(PINNED);
});

test("devkit and trust are one implementation", () => {
  const files = Object.entries(content).map(([path, text]) => ({ path, bytes: utf8(text) }));
  expect(isHashed).toBe(isHashedSource);
  expect(hashFiles(files.filter((f) => isHashed(f.path)))).toBe(sourceHash(files));
  expect(sourceHash(files)).toBe(PINNED);
});
