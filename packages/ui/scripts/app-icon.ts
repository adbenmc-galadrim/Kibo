import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { kiboMarkSvg, type MarkMode } from "../src/shell/kibo-mark";

export type IconTarget = { path: string; mode: MarkMode; size: number; art: number };

export const ICON_TARGETS: readonly IconTarget[] = [
  { path: "apps/desktop/app-icon.svg", mode: "light", size: 1024, art: 824 },
  { path: "packages/ui/public/favicon.svg", mode: "auto", size: 64, art: 64 },
];

export function writeIcons(repoRoot: string): string[] {
  return ICON_TARGETS.map((target) => {
    const file = resolve(repoRoot, target.path);
    writeFileSync(file, `${kiboMarkSvg(target.mode, target.size, target.art)}\n`);
    return file;
  });
}

if (import.meta.main) {
  for (const file of writeIcons(resolve(import.meta.dir, "../../.."))) console.log(`written ${file}`);
}
