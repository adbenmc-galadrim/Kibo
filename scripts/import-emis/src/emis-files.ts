import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SourceFile = { source: string; content: string };
export type EmisFiles = {
  claudeMd: string | null;
  kiboMd: string | null;
  passation: string | null;
  lexique: string | null;
  todo: string | null;
  briefs: { id: string; content: string }[];
  reviews: SourceFile[];
  design: SourceFile[];
  repoReadmes: string[];
};

const BRIEF = /^([A-Z][A-Z\d]-\d+)\.md$/;
const GATES = /^[A-Za-z\d-]+-gates\.md$/;
const DESIGN_FILES = [
  "storybook-brief.md",
  "storybook-inventaire.md",
  "tablet-brief.md",
  "pixel-loop-brief.md",
];
const REVIEW_FILES = ["c2-1-revue-adversariale.md"];
const SKIPPED_DIRS = new Set(["node_modules", "dist", "build", "coverage"]);
const README_DEPTH = 4;

const readIfExists = (file: string): string | null => (existsSync(file) ? readFileSync(file, "utf8") : null);
const listDir = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);

function sourceFiles(emisDir: string, relDir: string, names: string[]): SourceFile[] {
  return names.flatMap((name) => {
    const source = `${relDir}/${name}`;
    const content = readIfExists(join(emisDir, source));
    return content === null ? [] : [{ source, content }];
  });
}

function findReadmes(root: string, rel: string, depth: number): string[] {
  if (depth > README_DEPTH) return [];
  return readdirSync(join(root, rel), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isFile()) return entry.name === "README.md" ? [path] : [];
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIPPED_DIRS.has(entry.name)) return [];
      return findReadmes(root, path, depth + 1);
    });
}

export function loadEmisFiles(emisDir: string, repoFolder: string): EmisFiles {
  const briefs = listDir(join(emisDir, "tmp", "briefs")).flatMap((name) => {
    const id = BRIEF.exec(name)?.[1];
    return id ? [{ id, content: readFileSync(join(emisDir, "tmp", "briefs", name), "utf8") }] : [];
  });
  return {
    claudeMd: readIfExists(join(emisDir, "CLAUDE.md")),
    kiboMd: readIfExists(join(emisDir, "KIBO.md")),
    passation: readIfExists(join(emisDir, "PASSATION.md")),
    lexique: readIfExists(join(emisDir, "LEXIQUE.md")),
    todo: readIfExists(join(emisDir, "TODO.md")),
    briefs,
    reviews: [
      ...sourceFiles(emisDir, "tmp", REVIEW_FILES),
      ...sourceFiles(
        emisDir,
        "tmp/reports",
        listDir(join(emisDir, "tmp", "reports")).filter((n) => GATES.test(n)),
      ),
    ],
    design: sourceFiles(emisDir, "tmp", DESIGN_FILES),
    repoReadmes: existsSync(repoFolder) ? findReadmes(repoFolder, "", 0) : [],
  };
}
