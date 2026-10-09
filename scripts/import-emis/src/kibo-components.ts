import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentManifest } from "@kibo/schema";
import type { DesiredPage } from "./desired";

export const KIBO_REPO = join(import.meta.dir, "..", "..", "..");

export function builtinVersions(pages: readonly DesiredPage[], kiboRepo = KIBO_REPO): Map<string, string> {
  const versions = new Map<string, string>();
  for (const id of new Set(pages.flatMap((p) => p.instances.map((i) => i.componentId)))) {
    const file = join(kiboRepo, "components", id, "kibo.component.json");
    if (existsSync(file))
      versions.set(id, ComponentManifest.parse(JSON.parse(readFileSync(file, "utf8"))).version);
  }
  return versions;
}
