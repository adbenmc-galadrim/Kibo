import { expect, test } from "bun:test";
import { join } from "node:path";
import { formatHits, scanRepo } from "./src/repo-scan";
import { DEFAULT_TERMS_PATH, loadTerms } from "./src/terms";
import { scopeOf } from "./src/tracked-files";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const REPORTED_HITS = 50;
const terms = loadTerms(process.env.FORBIDDEN_TERMS_PATH ?? DEFAULT_TERMS_PATH);

test.skipIf(terms === null)(
  "aucun terme interdit dans les fichiers suivis",
  () => {
    const list = terms ?? [];
    const hits = scanRepo(REPO_ROOT, list, scopeOf(process.env.FORBIDDEN_TERMS_SCOPE));
    if (hits.length > 0) throw new Error(formatHits(hits, list, REPORTED_HITS));
    expect(hits).toHaveLength(0);
  },
  120_000,
);
