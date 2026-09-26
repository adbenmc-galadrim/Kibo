import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "testing" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("production code of the daemon never imports the sync server", () => {
  const offenders = sources(root)
    .filter((file) => readFileSync(file, "utf8").includes("@kibo/sync-server"))
    .map((file) => relative(root, file));
  expect(offenders).toEqual([]);
});
