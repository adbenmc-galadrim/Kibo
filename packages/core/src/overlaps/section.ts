import {
  DUPLICATION_LIMITS,
  maskSecrets,
  type Overlap,
  type OverlapRole,
  overlapSummary,
  type ParallelFile,
  type ParallelRun,
  type ParallelWork,
  PEEK_WORK_TOOL,
  type Step,
  WORK_SECTION_FOOTER,
  WORK_SECTION_OVERLAPS,
  WORK_SECTION_TITLE,
} from "@kibo/schema";

const TRUNCATED = "… (section tronquée)";
const ELAPSED = /démarré il y a [^·\n]*/g;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const othersLine = (n: number, tail = ""): string => `… ${n} autre${n > 1 ? "s" : ""}${tail}`;

function elapsed(ms: number): string {
  if (ms < HOUR) return `${Math.max(0, Math.floor(ms / MINUTE))} min`;
  if (ms < 2 * DAY) return `${Math.floor(ms / HOUR)} h`;
  return `${Math.floor(ms / DAY)} j`;
}

function bounded<T>(items: readonly T[], max: number, line: (item: T) => string, indent: string): string[] {
  const shown = items.slice(0, max).map(line);
  return items.length > max ? [...shown, `${indent}${othersLine(items.length - max)}`] : shown;
}

const byPath = (a: ParallelFile, b: ParallelFile): number =>
  a.path.localeCompare(b.path) ||
  a.status.localeCompare(b.status) ||
  a.added - b.added ||
  a.removed - b.removed;

const SPACE: Record<ParallelRun["workspace"], (run: ParallelRun) => string> = {
  worktree: (run) => (run.worktreeName ? `worktree \`${run.worktreeName}\`` : "worktree"),
  repo: () => "dossier du projet",
  shared: () => "dossier du projet, partagé avec toi : ses fichiers sont les tiens",
  isolated: () => "dossier isolé, non comparé",
};

function planLines(plan: readonly Step[] | null): string[] {
  if (plan === null) return ["- aucun plan déclaré"];
  const steps = bounded(
    plan.map((s, i) => `  ${i + 1}. [${s.status}] ${s.title}`),
    DUPLICATION_LIMITS.sectionSteps,
    (l) => l,
    "  ",
  );
  return ["- Plan :", ...steps];
}

const ALSO_MINE = " (aussi modifié par toi)";

function fileLines(run: ParallelRun, mine: ReadonlySet<string>): string[] {
  if (run.files.length === 0) return [];
  const head = run.truncated
    ? "- Fichiers créés ou modifiés (liste partielle) :"
    : "- Fichiers créés ou modifiés :";
  const files = [...run.files].sort(byPath);
  return [
    head,
    ...bounded(
      files,
      DUPLICATION_LIMITS.sectionFiles,
      (f) => `  - \`${f.path}\` (+${f.added} −${f.removed})${mine.has(f.path) ? ALSO_MINE : ""}`,
      "  - ",
    ),
  ];
}

function exportLines(run: ParallelRun): string[] {
  if (run.exports.length === 0) return [];
  const exports = [...run.exports].sort(
    (a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name),
  );
  return [
    "- Exports nouveaux :",
    ...bounded(
      exports,
      DUPLICATION_LIMITS.sectionExports,
      (e) => `  - \`${e.name}\` (\`${e.path}\`)`,
      "  - ",
    ),
  ];
}

function runLines(run: ParallelRun, now: number, mine: ReadonlySet<string>): string[] {
  const step = run.step ? ` · étape : ${run.step}` : "";
  return [
    "",
    `### ${run.name} · ${run.ticketTitle}`,
    "",
    `- démarré il y a ${elapsed(now - run.startedAt)}${step}`,
    ...planLines(run.plan),
    ...fileLines(run, mine),
    ...exportLines(run),
    `- Espace : ${SPACE[run.workspace](run)}`,
  ];
}

function overlapLine(o: Overlap, runs: readonly ParallelRun[]): string {
  const owner = runs.find((r) => r.runId === o.ownerRunId);
  const other = runs.find((r) => r.runId === o.otherRunId);
  const role: OverlapRole = owner === undefined && other !== undefined ? "owner" : "other";
  const name = (role === "other" ? owner?.name : other?.name) ?? "un autre run";
  return `- ${overlapSummary(o.detail, name, role)}`;
}

function overlapLines(overlaps: readonly Overlap[], runs: readonly ParallelRun[]): string[] {
  if (overlaps.length === 0) return [];
  const sorted = [...overlaps].sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.id.localeCompare(b.id));
  return [
    "",
    WORK_SECTION_OVERLAPS,
    "",
    ...bounded(sorted, DUPLICATION_LIMITS.sectionOverlaps, (o) => overlapLine(o, runs), ""),
  ];
}

function bodyLines(work: ParallelWork, now: number): string[] {
  const runs = [...work.runs].sort((a, b) => a.startedAt - b.startedAt || a.runId.localeCompare(b.runId));
  const shown = runs.slice(0, DUPLICATION_LIMITS.sectionRuns);
  const hidden = runs.length - shown.length + work.more;
  const mine = new Set(work.sharedPaths ?? []);
  return [
    WORK_SECTION_TITLE,
    ...shown.flatMap((r) => runLines(r, now, mine)),
    ...(hidden > 0 ? ["", othersLine(hidden, ` : \`${PEEK_WORK_TOOL}\``)] : []),
    ...overlapLines(work.overlaps, work.runs),
    ...(work.partial
      ? ["", "Détection partielle : un espace de travail n'a pas pu être lu, la liste peut être incomplète."]
      : []),
  ];
}

function fit(body: readonly string[], footer: string): string {
  const max = DUPLICATION_LIMITS.sectionChars;
  const whole = [...body, "", footer].join("\n");
  if (whole.length <= max) return whole;
  const budget = max - footer.length - TRUNCATED.length - 3;
  const kept: string[] = [];
  let size = 0;
  for (const line of body) {
    if (size + line.length + 1 > budget) break;
    kept.push(line);
    size += line.length + 1;
  }
  return [...kept, TRUNCATED, "", footer].join("\n");
}

export function composeWorkSection(work: ParallelWork, now: number): string | null {
  if (work.runs.length === 0 && work.more === 0) return null;
  const body = bodyLines(work, now).map(maskSecrets);
  return fit(body, WORK_SECTION_FOOTER);
}

export function sectionFingerprint(section: string | null, hash: (text: string) => string): string {
  return section === null ? "none" : hash(section.replace(ELAPSED, "démarré"));
}
