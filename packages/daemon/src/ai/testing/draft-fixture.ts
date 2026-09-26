import { afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { draftPaths, prepareDraft } from "../draft-files";

const homes: string[] = [];

export const home = () => {
  const h = mkdtempSync(join(tmpdir(), "kibo-draft-"));
  homes.push(h);
  return h;
};

export const cleanHomes = () =>
  afterEach(() => {
    for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
  });

const manifest = {
  id: "burndown",
  version: "0.1.0",
  kind: "widget",
  title: "Burndown",
  reads: [],
  writes: [],
};

export const scaffold = async (dir: string) => {
  writeFileSync(join(dir, "kibo.component.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, "ui.tsx"), "export const Component = () => null;\n");
  writeFileSync(join(dir, "component.test.tsx"), "runConformance({ manifest, Component });\n");
  writeFileSync(join(dir, "tsconfig.json"), "{}\n");
};

export const kiboFiles = {
  "CLAUDE.md": "# Règles\n",
  ".claude/skills/kibo-component/SKILL.md": "---\nname: kibo-component\n---\n",
};

export async function prepared() {
  const paths = draftPaths(home(), "d1");
  await prepareDraft({ paths, fill: scaffold, kiboFiles });
  return paths;
}
