import type { Project } from "@playwright/test";
import { PIXEL_DAEMONS } from "./pixel-projects";
import { SILO_MAQUETTES } from "./pixel-settings";

export const ALL_DAEMONS = [
  { name: "dark", scheme: "dark", port: 4390, spec: /mvp\.spec\.ts/, scenario: "question" },
  { name: "light", scheme: "light", port: 4391, spec: /mvp\.spec\.ts/, scenario: "question" },
  { name: "tabs-dark", scheme: "dark", port: 4396, spec: /tabs\.spec\.ts/, scenario: "question" },
  { name: "tabs-light", scheme: "light", port: 4397, spec: /tabs\.spec\.ts/, scenario: "question" },
  { name: "screens-dark", scheme: "dark", port: 4398, spec: /screens\.spec\.ts/, scenario: "routes" },
  { name: "screens-light", scheme: "light", port: 4399, spec: /screens\.spec\.ts/, scenario: "routes" },
  {
    name: "catalog-dark",
    scheme: "dark",
    port: 4400,
    spec: /catalog\.spec\.ts/,
    scenario: "question",
    drafts: "hello",
  },
  {
    name: "catalog-light",
    scheme: "light",
    port: 4401,
    spec: /catalog\.spec\.ts/,
    scenario: "question",
    drafts: "hello",
  },
  {
    name: "integrations-dark",
    scheme: "dark",
    port: 4402,
    spec: /integrations\.spec\.ts/,
    scenario: "question",
    integrations: true,
  },
  {
    name: "integrations-light",
    scheme: "light",
    port: 4403,
    spec: /integrations\.spec\.ts/,
    scenario: "question",
    integrations: true,
  },
  { name: "menus-dark", scheme: "dark", port: 4415, spec: /menus\.spec\.ts/, scenario: "question" },
  { name: "menus-light", scheme: "light", port: 4416, spec: /menus\.spec\.ts/, scenario: "question" },
  { name: "projects-dark", scheme: "dark", port: 4417, spec: /projects\.spec\.ts/, scenario: "question" },
  { name: "projects-light", scheme: "light", port: 4418, spec: /projects\.spec\.ts/, scenario: "question" },
  { name: "inbox-dark", scheme: "dark", port: 4419, spec: /inbox\.spec\.ts/, scenario: "question" },
  { name: "inbox-light", scheme: "light", port: 4420, spec: /inbox\.spec\.ts/, scenario: "question" },
  { name: "confort-dark", scheme: "dark", port: 4421, spec: /confort\.spec\.ts/, scenario: "question" },
  { name: "confort-light", scheme: "light", port: 4422, spec: /confort\.spec\.ts/, scenario: "question" },
  { name: "layout-dark", scheme: "dark", port: 4423, spec: /layout\.spec\.ts/, scenario: "question" },
  { name: "layout-light", scheme: "light", port: 4424, spec: /layout\.spec\.ts/, scenario: "question" },
  { name: "notes-dark", scheme: "dark", port: 4431, spec: /notes\.spec\.ts/, scenario: "question" },
  { name: "notes-light", scheme: "light", port: 4432, spec: /notes\.spec\.ts/, scenario: "question" },
  { name: "widgets-dark", scheme: "dark", port: 4429, spec: /widgets\.spec\.ts/, scenario: "question" },
  { name: "widgets-light", scheme: "light", port: 4430, spec: /widgets\.spec\.ts/, scenario: "question" },
  { name: "graph-dark", scheme: "dark", port: 4433, spec: /graph\.spec\.ts/, scenario: "question" },
  { name: "graph-light", scheme: "light", port: 4434, spec: /graph\.spec\.ts/, scenario: "question" },
  { name: "viewer-dark", scheme: "dark", port: 4437, spec: /viewer\.spec\.ts/, scenario: "question" },
  { name: "viewer-light", scheme: "light", port: 4438, spec: /viewer\.spec\.ts/, scenario: "question" },
  { name: "kanban-dark", scheme: "dark", port: 4455, spec: /kanban-drag\.spec\.ts/, scenario: "question" },
  { name: "kanban-light", scheme: "light", port: 4456, spec: /kanban-drag\.spec\.ts/, scenario: "question" },
  {
    name: "questions-dark",
    scheme: "dark",
    port: 4457,
    spec: /\/questions\.spec\.ts$/,
    scenario: "question",
  },
  {
    name: "questions-light",
    scheme: "light",
    port: 4458,
    spec: /\/questions\.spec\.ts$/,
    scenario: "question",
  },
  {
    name: "project-agent-dark",
    scheme: "dark",
    port: 4459,
    spec: /project-agent\.spec\.ts/,
    scenario: "project-agent-routes",
  },
  {
    name: "project-agent-light",
    scheme: "light",
    port: 4460,
    spec: /project-agent\.spec\.ts/,
    scenario: "project-agent-routes",
  },
  {
    name: "files-dark",
    scheme: "dark",
    port: 4435,
    spec: /files\.spec\.ts/,
    scenario: "question",
    drafts: "viewer",
  },
  {
    name: "files-light",
    scheme: "light",
    port: 4436,
    spec: /files\.spec\.ts/,
    scenario: "question",
    drafts: "viewer",
  },
  { name: "retired-dark", scheme: "dark", port: 4439, spec: /retired\.spec\.ts/, scenario: "question" },
  { name: "retired-light", scheme: "light", port: 4440, spec: /retired\.spec\.ts/, scenario: "question" },
  {
    name: "add-component-dark",
    scheme: "dark",
    port: 4463,
    spec: /add-component\.spec\.ts/,
    scenario: "question",
  },
  {
    name: "add-component-light",
    scheme: "light",
    port: 4464,
    spec: /add-component\.spec\.ts/,
    scenario: "question",
  },
  { name: "about-dark", scheme: "dark", port: 4449, spec: /about\.spec\.ts/, scenario: "question" },
  { name: "about-light", scheme: "light", port: 4450, spec: /about\.spec\.ts/, scenario: "question" },
  { name: "help-dark", scheme: "dark", port: 4451, spec: /help\.spec\.ts/, scenario: "question" },
  { name: "help-light", scheme: "light", port: 4452, spec: /help\.spec\.ts/, scenario: "question" },
  { name: "backups-dark", scheme: "dark", port: 4447, spec: /backups\.spec\.ts/, scenario: "question" },
  { name: "backups-light", scheme: "light", port: 4448, spec: /backups\.spec\.ts/, scenario: "question" },
  {
    name: "design-dark",
    scheme: "dark",
    port: 4453,
    spec: /design\.spec\.ts/,
    scenario: "question",
    design: true,
  },
  {
    name: "design-light",
    scheme: "light",
    port: 4454,
    spec: /design\.spec\.ts/,
    scenario: "question",
    design: true,
  },
  {
    name: "embeds-dark",
    scheme: "dark",
    port: 4461,
    spec: /embeds\.spec\.ts/,
    scenario: "question",
    embeds: true,
  },
  {
    name: "embeds-light",
    scheme: "light",
    port: 4462,
    spec: /embeds\.spec\.ts/,
    scenario: "question",
    embeds: true,
  },
  {
    name: "suivi-dark",
    scheme: "dark",
    port: 4479,
    spec: /(suivi|suivi-retours|barre-laterale)\.spec\.ts/,
    scenario: SILO_MAQUETTES,
    integrations: true,
  },
  {
    name: "suivi-light",
    scheme: "light",
    port: 4480,
    spec: /(suivi|suivi-retours|barre-laterale)\.spec\.ts/,
    scenario: SILO_MAQUETTES,
    integrations: true,
  },
  {
    name: "reveil-dark",
    scheme: "dark",
    port: 4483,
    spec: /reveil\.spec\.ts/,
    scenario: SILO_MAQUETTES,
    agentScenario: "reveil-routes",
    answerWakeGraceMs: 0,
    integrations: true,
  },
  {
    name: "reveil-light",
    scheme: "light",
    port: 4484,
    spec: /reveil\.spec\.ts/,
    scenario: SILO_MAQUETTES,
    agentScenario: "reveil-routes",
    answerWakeGraceMs: 0,
    integrations: true,
  },
  ...PIXEL_DAEMONS,
] as const;

const AGENT_CONVERSATION_SPEC = /agent-conversation\.spec\.ts$/;

export const agentConversationProjects = (daemons: readonly string[]): Project[] =>
  ALL_DAEMONS.filter((d) => d.name.startsWith("suivi-") && daemons.includes(d.name)).map((d) => ({
    name: `agent-conversation-${d.scheme}`,
    testMatch: AGENT_CONVERSATION_SPEC,
    dependencies: [d.name],
    use: { browserName: "chromium", colorScheme: d.scheme, baseURL: `http://127.0.0.1:${d.port}` },
  }));

type ServedDaemon = {
  port: number;
  scenario: string;
  integrations?: boolean;
  noGh?: boolean;
  design?: boolean;
  embeds?: boolean;
  agentScenario?: string;
  answerWakeGraceMs?: number;
  drafts?: string;
};

export const serveCommand = (d: ServedDaemon): string =>
  [
    "bun serve.ts",
    d.port,
    d.scenario,
    "integrations" in d ? "--integrations" : "",
    "noGh" in d ? "--no-gh" : "",
    "design" in d ? "--design" : "",
    "embeds" in d ? "--embeds" : "",
    "agentScenario" in d ? `--agent-scenario ${d.agentScenario}` : "",
    "answerWakeGraceMs" in d ? `--answer-wake-grace-ms ${d.answerWakeGraceMs}` : "",
    "drafts" in d ? d.drafts : "",
  ]
    .filter((part) => part !== "")
    .join(" ");
