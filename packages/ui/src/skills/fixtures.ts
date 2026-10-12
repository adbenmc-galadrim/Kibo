import type { Skill, SkillReview } from "@kibo/schema";

export const HOUR = 3_600_000;

export const SKILL_TEXT = [
  "---",
  "name: porte-qualite",
  "description: Porte qualité d'une branche avant son push.",
  "allowed-tools: Read, Grep",
  "user-invocable: true",
  "context: fork",
  "---",
  "",
  "# Porte qualité",
  "Relis le diff d'une branche avant son push.",
  "",
].join("\n");

export function skillFixture(over: Partial<Skill> = {}): Skill {
  const source = over.source ?? "user";
  const name = over.name ?? "porte-qualite";
  return {
    id: name,
    source,
    projectId: null,
    plugin: null,
    name,
    description: "Porte qualité d'une branche avant son push.",
    path: `~/.claude/skills/${name}`,
    file: {
      frontmatter: {
        name,
        description: "Porte qualité d'une branche avant son push.",
        allowedTools: ["Read", "Grep"],
        userInvocable: true,
        extra: "context: fork",
        extraKeys: ["context"],
      },
      body: "# Porte qualité\nRelis le diff d'une branche avant son push.\n",
    },
    problem: null,
    hash: "h1",
    readOnly: source === "plugin",
    shadowedBy: null,
    files: [],
    usage: { last: null, runs30d: 0 },
    reviews: { open: 0 },
    modifiedAt: Date.now() - HOUR,
    ...over,
  };
}

export function pluginSkill(name: string, over: Partial<Skill> = {}): Skill {
  return skillFixture({
    id: `superpowers:${name}`,
    name,
    source: "plugin",
    plugin: { name: "superpowers", version: "6.4.1" },
    path: `~/.claude/plugins/cache/official/superpowers/6.4.1/skills/${name}`,
    readOnly: true,
    description: "Explore l'intention avant un travail créatif.",
    ...over,
  });
}

export const skillsFixture = (): Skill[] => [
  skillFixture({
    reviews: { open: 2 },
    usage: { last: { runId: "r41", ticketKey: "KIB-14", at: Date.now() - 2 * 24 * HOUR }, runs30d: 7 },
    files: [
      { path: "volets/conventions.md", size: 1700, text: true },
      { path: "exemple.png", size: 48_000, text: false },
    ],
  }),
  skillFixture({ id: "apply-review", name: "apply-review", description: "Traite les reviews d'une PR." }),
  skillFixture({
    id: "clean-pr",
    name: "clean-pr",
    source: "project",
    projectId: "kibo",
    path: "/Users/adam/goinfre/Kibo/.claude/skills/clean-pr",
    description: "Démonte l'environnement local d'une PR.",
    shadowedBy: "clean-pr",
  }),
  pluginSkill("brainstorming", { reviews: { open: 1 } }),
  pluginSkill("writing-plans", { description: "Transforme une spec en plan de tâches." }),
];

export function reviewFixture(over: Partial<SkillReview> = {}): SkillReview {
  return {
    id: "rv1",
    runId: "r41",
    runLabel: "global · livraison · KIB-14",
    agentName: "livraison",
    projectId: "kibo",
    ticketId: "t14",
    ticketKey: "KIB-14",
    skillId: "porte-qualite",
    skillPath: "~/.claude/skills/porte-qualite",
    baseHash: "h1",
    verdict: "improve",
    note: "Le volet conventions a relu tout le fichier.\nIl manque la règle des commentaires.\nBorner aux lignes modifiées.",
    suggestion: `${SKILL_TEXT}Relis uniquement les lignes modifiées.\n`,
    createdAt: Date.now() - 2 * HOUR,
    status: "new",
    decidedAt: null,
    decidedBy: null,
    versionId: null,
    ...over,
  };
}
