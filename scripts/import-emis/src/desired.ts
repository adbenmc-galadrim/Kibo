import { type AgentSettingsPatch, type Layout, layoutFor, type PrInfo } from "@kibo/schema";
import { type DesiredNote, desiredNotes } from "./desired-notes";
import { type DesiredQuestion, desiredQuestions } from "./desired-questions";
import { type DesiredLink, type DesiredTicket, desiredLinks, desiredTickets } from "./desired-tickets";
import type { EmisFiles } from "./emis-files";
import { livraisonGuideline } from "./livraison-template";
import { cutClaudeMd } from "./markdown";
import type { Answers, EmisPlan } from "./plan-source";

export type { DesiredLink, DesiredNote, DesiredQuestion, DesiredTicket };
export type DesiredInstance = { componentId: string; config: Record<string, unknown>; layout?: Layout };
export type DesiredPage = { title: string; kind: "dashboard" | "view"; instances: DesiredInstance[] };
export type DesiredGuideline = { path: string; content: string };
export type DesiredAgent = { name: string; model: string; settings: AgentSettingsPatch };
export type Desired = {
  project: { name: "Emis"; key: "EMIS"; color: string };
  tickets: DesiredTicket[];
  links: DesiredLink[];
  questions: DesiredQuestion[];
  notes: DesiredNote[];
  pages: DesiredPage[];
  agent: DesiredAgent;
  guidelines: DesiredGuideline[];
};
export type DesiredInput = {
  plan: EmisPlan;
  answers: Answers;
  files: EmisFiles;
  repoUrl: string;
  prs: Map<number, PrInfo>;
  notesDir: string;
};

export const PROFILE_ALLOW = [
  "Bash(pnpm *)",
  "Bash(git *)",
  "Bash(gh pr *)",
  "Bash(docker compose *)",
  "Bash(npx playwright *)",
];

const view = (title: string, componentId: string, config: Record<string, unknown> = {}): DesiredPage => ({
  title,
  kind: "view",
  instances: [{ componentId, config }],
});

const GRAPH_CONFIG = { filter: "all" };

export const PAGES: DesiredPage[] = [
  {
    title: "Tableau de bord",
    kind: "dashboard",
    instances: [
      { componentId: "kanban", config: {}, layout: layoutFor("large", 0, 0) },
      { componentId: "graph", config: GRAPH_CONFIG, layout: layoutFor("half", 0, 6) },
    ],
  },
  view("Plan", "tickets"),
  view("Graphe", "graph", GRAPH_CONFIG),
  view("Notes", "notes"),
];

export const AGENT: DesiredAgent = {
  name: "emis-livraison",
  model: "opus",
  settings: { permissionMode: "auto", workspace: "worktree", maxParallel: 2, allow: PROFILE_ALLOW },
};

function guidelines(input: DesiredInput): DesiredGuideline[] {
  const rules =
    input.files.claudeMd === null
      ? []
      : [{ path: "emis/regles.md", content: cutClaudeMd(input.files.claudeMd) }];
  return [
    ...rules,
    { path: "emis/livraison.md", content: livraisonGuideline(input.plan.process, input.notesDir) },
  ];
}

export function desiredState(input: DesiredInput): Desired {
  return {
    project: { name: "Emis", key: "EMIS", color: "#B45309" },
    tickets: desiredTickets({ ...input, todo: input.files.todo }),
    links: desiredLinks(input.plan),
    questions: desiredQuestions(input.plan, input.answers),
    notes: desiredNotes(input.plan, input.files),
    pages: PAGES,
    agent: AGENT,
    guidelines: guidelines(input),
  };
}
