import type { EmisFiles, SourceFile } from "./emis-files";
import { citedPlanIds, cutClaudeMd, splitPassation, withFrontmatter } from "./markdown";
import {
  criticalPathNote,
  decisionsNote,
  depotNote,
  etatNote,
  planNote,
  processNote,
  sprintsNote,
} from "./plan-notes";
import { type EmisPlan, flatPrs } from "./plan-source";

export type DesiredNote = { path: string; content: string };
type NoteSource = { path: string; source: string; body: string; own?: string };

const PLAN_SOURCE = "tmp/plan-data.js";

function passationNotes(passation: string): NoteSource[] {
  const { intro, sections } = splitPassation(passation);
  const index = [
    intro.trimEnd(),
    "",
    ...sections.map((s) => `- [${s.number}. ${s.title}](${s.number}-${s.slug}.md)`),
    "",
  ].join("\n");
  return [
    { path: "metier/passation/index.md", source: "PASSATION.md", body: index },
    ...sections.map((s) => ({
      path: `metier/passation/${s.number}-${s.slug}.md`,
      source: "PASSATION.md",
      body: s.body,
    })),
  ];
}

const copied = (dir: string, files: readonly SourceFile[]): NoteSource[] =>
  files.map((f) => ({
    path: `${dir}/${f.source.split("/").at(-1) ?? f.source}`,
    source: f.source,
    body: f.content,
  }));

function optional(path: string, source: string, body: string | null): NoteSource[] {
  return body === null ? [] : [{ path, source, body }];
}

function noteSources(plan: EmisPlan, files: EmisFiles): NoteSource[] {
  return [
    ...optional("pilotage/regles-worktrees.md", "CLAUDE.md", files.claudeMd && cutClaudeMd(files.claudeMd)),
    ...optional("pilotage/journal.md", "KIBO.md", files.kiboMd),
    { path: "pilotage/plan.md", source: PLAN_SOURCE, body: planNote(plan) },
    { path: "pilotage/decisions.md", source: PLAN_SOURCE, body: decisionsNote(plan) },
    { path: "pilotage/etat.md", source: PLAN_SOURCE, body: etatNote(plan) },
    { path: "pilotage/sprints.md", source: PLAN_SOURCE, body: sprintsNote(plan) },
    { path: "pilotage/chemin-critique.md", source: PLAN_SOURCE, body: criticalPathNote(plan) },
    { path: "pilotage/process.md", source: PLAN_SOURCE, body: processNote(plan) },
    { path: "pilotage/depot.md", source: "emis/", body: depotNote(files.repoReadmes) },
    ...optional("metier/lexique.md", "LEXIQUE.md", files.lexique),
    ...(files.passation === null ? [] : passationNotes(files.passation)),
    ...files.briefs.map((b) => ({
      path: `briefs/${b.id}.md`,
      source: `tmp/briefs/${b.id}.md`,
      body: b.content,
      own: b.id,
    })),
    ...copied("revues", files.reviews),
    ...copied("design", files.design),
  ];
}

export function desiredNotes(plan: EmisPlan, files: EmisFiles): DesiredNote[] {
  const known = new Set(flatPrs(plan).map((p) => p.id));
  return noteSources(plan, files).map((n) => {
    const cited = citedPlanIds(`${n.own ?? ""} ${n.body}`).filter((id) => known.has(id));
    const tickets = cited.map((id) => `plan:${id}`);
    return {
      path: n.path,
      content: withFrontmatter({ source: n.source, imported: plan.meta.updatedAt, tickets }, n.body),
    };
  });
}
