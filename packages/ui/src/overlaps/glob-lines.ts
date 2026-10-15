import { frOverlaps } from "../i18n/fr-overlaps";

const t = frOverlaps.settings;
const MAX_GLOBS = 50;
const MAX_GLOB_CHARS = 200;

export function parseGlobs(text: string): { globs: string[]; problem: string | null } {
  const globs = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (globs.length > MAX_GLOBS) return { globs, problem: t.ignoreTooMany };
  if (globs.some((g) => g.length > MAX_GLOB_CHARS)) return { globs, problem: t.ignoreTooLong };
  return { globs, problem: null };
}
