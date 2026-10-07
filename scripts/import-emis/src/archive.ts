import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { KiboError } from "@kibo/schema";
import { cutClaudeMd } from "./markdown";

export const ARCHIVED = [
  "tmp/plan-data.js",
  "tmp/reponses.json",
  "tmp/briefs",
  "KIBO.md",
  "PASSATION.md",
  "LEXIQUE.md",
  "TODO.md",
] as const;
export const CLAUDE_POINTER = "Pilotage : projet EMIS dans Kibo.";
const REDIRECT_TITLE = "# Pilotage dans Kibo, projet EMIS";

export const kiboRedirect = (date: string): string =>
  [
    REDIRECT_TITLE,
    "",
    "Le plan, les arbitrages, le TODO, la passation, le lexique et les briefs vivent dans Kibo, projet EMIS.",
    `Les fichiers d'origine sont archivés dans \`archive-${date}/\`.`,
    "",
  ].join("\n");

const isRedirect = (file: string) =>
  existsSync(file) && readFileSync(file, "utf8").startsWith(REDIRECT_TITLE);

function move(emisDir: string, archiveDir: string, path: string): boolean {
  const from = join(emisDir, path);
  const to = join(archiveDir, path);
  if (!existsSync(from) || (path === "KIBO.md" && isRedirect(from))) return false;
  if (existsSync(to)) throw new KiboError("CONFLICT", `${to} already exists`);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  return true;
}

function rewriteClaudeMd(emisDir: string, archiveDir: string): boolean {
  const file = join(emisDir, "CLAUDE.md");
  if (!existsSync(file)) return false;
  const original = readFileSync(file, "utf8");
  if (!/^## 4\./m.test(original)) return false;
  const backup = join(archiveDir, "CLAUDE.md");
  if (!existsSync(backup)) {
    mkdirSync(archiveDir, { recursive: true });
    copyFileSync(file, backup);
  }
  writeFileSync(file, `${cutClaudeMd(original)}\n${CLAUDE_POINTER}\n`);
  return true;
}

export function archive(emisDir: string, date: string): string[] {
  const archiveDir = join(emisDir, `archive-${date}`);
  const done: string[] = ARCHIVED.filter((path) => move(emisDir, archiveDir, path));
  const kibo = join(emisDir, "KIBO.md");
  if (!existsSync(kibo)) writeFileSync(kibo, kiboRedirect(date));
  if (rewriteClaudeMd(emisDir, archiveDir)) done.push("CLAUDE.md");
  return done;
}
