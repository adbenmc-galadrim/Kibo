import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findForbidden, isBinary, maskTerms } from "./scan";
import { inScope, trackedFiles } from "./tracked-files";

export type Hit = { path: string; line: number | null; term: number };

function scanFile(root: string, path: string, terms: readonly string[]): Hit[] {
  const nameHits = findForbidden(path, terms).map(({ term }) => ({ path, line: null, term }));
  const bytes = readFileSync(join(root, path));
  if (isBinary(bytes)) return nameHits;
  const contentHits = findForbidden(new TextDecoder().decode(bytes), terms).map(({ term, line }) => ({
    path,
    line,
    term,
  }));
  return [...nameHits, ...contentHits];
}

export function scanRepo(root: string, terms: readonly string[], scope: readonly string[]): Hit[] {
  return trackedFiles(root)
    .filter((path) => inScope(path, scope) && existsSync(join(root, path)))
    .sort()
    .flatMap((path) => scanFile(root, path, terms));
}

function formatHit({ path, line, term }: Hit, terms: readonly string[]): string {
  return `${maskTerms(path, terms)}:${line ?? "nom"} terme ${term}`;
}

export function formatHits(hits: readonly Hit[], terms: readonly string[], limit: number): string {
  const shown = hits.slice(0, limit).map((hit) => formatHit(hit, terms));
  const rest = hits.length - shown.length;
  return [`${hits.length} hits`, ...shown, ...(rest > 0 ? [`… et ${rest} autres`] : [])].join("\n");
}
