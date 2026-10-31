import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILTIN_IDS, ComponentManifest } from "@kibo/schema";
import { BUILTIN_MANIFESTS, builtinManifestOf } from "./builtin-manifests";

const COMPONENTS = join(import.meta.dir, "../../../../components");
const ids: readonly string[] = BUILTIN_IDS;
const onDisk = () =>
  readdirSync(COMPONENTS)
    .filter((dir) => ids.includes(dir))
    .sort()
    .map((dir) =>
      ComponentManifest.parse(JSON.parse(readFileSync(join(COMPONENTS, dir, "kibo.component.json"), "utf8"))),
    );

test("the daemon copy equals components/*/kibo.component.json", () => {
  const files = onDisk();
  expect(files.length).toBe(ids.length);
  expect([...BUILTIN_MANIFESTS].map((m) => m.id).sort()).toEqual(files.map((m) => m.id));
  for (const manifest of files) expect(BUILTIN_MANIFESTS.find((m) => m.id === manifest.id)).toEqual(manifest);
});

test("builtinManifestOf resolves an exact id@version only", () => {
  expect(builtinManifestOf("mockup@1.0.0")?.configSchema).toHaveProperty("frame");
  expect(builtinManifestOf("mockup@9.9.9")).toBeNull();
  expect(builtinManifestOf("notes@1.0.0")).toBeNull();
  expect(builtinManifestOf("ghost@1.0.0")).toBeNull();
});

test("the Kanban shows every ticket by default and reads the sprints", () => {
  const kanban = builtinManifestOf("kanban@1.0.0");
  expect(kanban?.configSchema).toEqual({ filter: { enum: ["mine-and-agents", "all"], default: "all" } });
  expect(kanban?.reads).toContain("sprint");
  expect(kanban?.reads).toContain("question");
});
