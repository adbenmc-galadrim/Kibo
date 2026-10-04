import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { TEMPLATES } from "@kibo/devkit";
import type { FakeScenario } from "../agents/fake-claude-scenario";

const DEMO_SCENARIO_NAMES = ["ticket", "component"] as const;
type DemoScenarioName = (typeof DEMO_SCENARIO_NAMES)[number];
export type DemoAgentFiles = { scenario: string; state: string; fixtures: string };

const ASK = { question: "Faut-il aussi mettre à jour la documentation ?" };
const BRIEF = { file_path: "brief.md" };
const ZERO = { isError: false, exitCode: 0, tokens: 0 } as const;

export const DEMO_SCENARIOS: Record<DemoScenarioName, FakeScenario> = {
  ticket: {
    turns: [
      {
        steps: [
          { hook: "PreToolUse", tool: "Read", input: BRIEF },
          { hook: "PostToolUse", tool: "Read", input: BRIEF },
          { hook: "PreToolUse", tool: "mcp__kibo__ask_user", input: ASK },
          { hook: "PostToolUse", tool: "mcp__kibo__ask_user", input: ASK },
        ],
        result: "J'ai relu le ticket, une question avant de continuer.",
        ...ZERO,
      },
      {
        steps: [{ write: "notes-de-l-agent.md", fixture: "ticket/notes.md.fixture", bypassHooks: false }],
        result: "Terminé : j'ai relu le ticket et noté le plan dans notes-de-l-agent.md",
        ...ZERO,
      },
    ],
  },
  component: {
    turns: [
      {
        steps: [
          { hook: "PreToolUse", tool: "Read", input: { file_path: "CLAUDE.md" } },
          { write: "ui.tsx", fixture: "chart/ui.tsx.fixture", bypassHooks: false },
          { hook: "PreToolUse", tool: "Bash", input: { command: "kibo component test ." } },
        ],
        result: "Composant écrit ; kibo component test . passe.",
        ...ZERO,
      },
    ],
  },
};

export const DEMO_ROUTES: {
  routes: { prompt: string; scenario: DemoScenarioName }[];
  fallback: DemoScenarioName;
} = {
  routes: [
    { prompt: "Écris le composant Kibo", scenario: "component" },
    { prompt: "Modifie le composant Kibo", scenario: "component" },
  ],
  fallback: "ticket",
};

export const DEMO_FIXTURES: Record<string, string> = {
  "chart/ui.tsx.fixture": TEMPLATES.chart.ui("Graphique d'avancement"),
  "ticket/notes.md.fixture": [
    "1. Relire le ticket et ses liens.",
    "2. Découper le travail en petites étapes.",
    "3. Mettre à jour la documentation si besoin.",
    "",
  ].join("\n"),
};

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

function writePrivate(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true, mode: DIR_MODE });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, content, { mode: FILE_MODE, flag: "wx" });
  renameSync(temporary, file);
}

export function ensureDemoAgentFiles(home: string): DemoAgentFiles {
  const root = join(home, "demo-agent");
  const scenarioFile = (name: DemoScenarioName) => join(root, "scenarios", `${name}.json`);
  const files: DemoAgentFiles = {
    scenario: join(root, "routes.json"),
    state: join(root, "state"),
    fixtures: join(root, "fixtures"),
  };
  mkdirSync(root, { recursive: true, mode: DIR_MODE });
  chmodSync(root, DIR_MODE);
  mkdirSync(files.state, { recursive: true, mode: DIR_MODE });
  for (const name of DEMO_SCENARIO_NAMES)
    writePrivate(scenarioFile(name), JSON.stringify(DEMO_SCENARIOS[name]));
  for (const [path, content] of Object.entries(DEMO_FIXTURES))
    writePrivate(join(files.fixtures, path), content);
  const routes = {
    routes: DEMO_ROUTES.routes.map((r) => ({ prompt: r.prompt, scenario: scenarioFile(r.scenario) })),
    fallback: scenarioFile(DEMO_ROUTES.fallback),
  };
  writePrivate(files.scenario, JSON.stringify(routes));
  return files;
}
