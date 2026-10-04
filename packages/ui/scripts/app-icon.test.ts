import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { kiboMarkSvg } from "../src/shell/kibo-mark";
import { ICON_TARGETS } from "./app-icon";

const repo = resolve(import.meta.dir, "../../..");

test("the committed app icon and favicon are exactly what the generator writes", () => {
  for (const target of ICON_TARGETS) {
    expect(readFileSync(resolve(repo, target.path), "utf8")).toBe(
      `${kiboMarkSvg(target.mode, target.size, target.art)}\n`,
    );
  }
});

test("the app icon is light at 1024 and the favicon follows the system scheme at 64", () => {
  expect(ICON_TARGETS).toEqual([
    { path: "apps/desktop/app-icon.svg", mode: "light", size: 1024, art: 824 },
    { path: "packages/ui/public/favicon.svg", mode: "auto", size: 64, art: 64 },
  ]);
});
