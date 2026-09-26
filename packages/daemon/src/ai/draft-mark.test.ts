import { expect, test } from "bun:test";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { draftPaths, isUnrestored, markUnrestored } from "./draft-files";

const DRAFT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

test("marking a draft never writes through a link planted at the mark", () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "kibo-mark-")));
  const paths = draftPaths(home, DRAFT_ID);
  mkdirSync(paths.dir, { recursive: true });
  const victim = join(home, "victim.txt");
  writeFileSync(victim, "keep");
  symlinkSync(victim, `${paths.dir}.unrestored`);
  markUnrestored(paths);
  expect(readFileSync(victim, "utf8")).toBe("keep");
  expect(lstatSync(`${paths.dir}.unrestored`).isFile()).toBe(true);
  expect(isUnrestored(paths)).toBe(true);
});
