import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TestInfo } from "@playwright/test";
import { homeOf } from "./e2e-home";

const KIBO_DEV = fileURLToPath(new URL("../.claude/agents/kibo-dev.md", import.meta.url));
const PLUGIN = ["plugins", "cache", "official", "superpowers", "6.4.1"];

export const agentMd = (name: string, description: string, body = `Tu es ${name}.`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

export const skillMd = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

export const BRAINSTORMING_BODY = [
  "# Brainstorming",
  "",
  "Avant de coder, liste les cas limites et les questions ouvertes.",
  "",
  "- Une idée par ligne.",
  "- Les exemples vivent dans exemples.md.",
].join("\n");

function put(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export type AgentFiles = { claude: string; kiboDev: string };

function seedClaudeHome(claude: string): void {
  put(
    join(claude, "agents", "review-pr.md"),
    agentMd("review-pr", "Relit une PR en lecture seule et rend un verdict accepté ou refusé"),
  );
  const skill = join(claude, "skills", "brainstorming");
  put(
    join(skill, "SKILL.md"),
    skillMd("brainstorming", "Explore une idée avant de coder", BRAINSTORMING_BODY),
  );
  put(
    join(skill, "exemples.md"),
    "# Exemples\n\n- Formulaire de connexion : e-mail vide, mot de passe trop court.\n",
  );
  const plugin = join(claude, ...PLUGIN);
  put(
    join(plugin, "skills", "brainstorming", "SKILL.md"),
    skillMd(
      "brainstorming",
      "Explore l'intention, les besoins et la conception avant tout travail créatif",
      "# Brainstorming du plugin",
    ),
  );
  const index = {
    version: 2,
    plugins: { "superpowers@official": [{ scope: "user", installPath: plugin, version: "6.4.1" }] },
  };
  put(join(claude, "plugins", "installed_plugins.json"), JSON.stringify(index));
}

function seedProjectFolder(folder: string): string {
  const agents = join(folder, ".claude", "agents");
  const kiboDev = join(agents, "kibo-dev.md");
  put(kiboDev, readFileSync(KIBO_DEV, "utf8"));
  put(join(agents, "livraison.md"), agentMd("livraison", "Livre un ticket en TDD avec des commits propres"));
  put(join(agents, "review.md"), agentMd("review", "Relit un diff et rend un verdict accepté ou refusé"));
  put(
    join(folder, ".claude", "skills", "brainstorming", "SKILL.md"),
    skillMd("brainstorming", "Explore une idée du projet Kibo", "# Brainstorming du projet"),
  );
  return kiboDev;
}

export function seedAgentFiles(info: TestInfo, projectFolder: string): AgentFiles {
  const claude = join(homeOf(info), "claude");
  seedClaudeHome(claude);
  return { claude, kiboDev: seedProjectFolder(projectFolder) };
}
