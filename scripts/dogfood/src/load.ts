import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentManifest, KiboError } from "@kibo/schema";
import { AGENT_SETTINGS, DOMAINS, GUIDELINE_PATHS, NOTES_SUBDIR, PAGES, PROJECT } from "../data/kibo";
import { TICKETS } from "../data/tickets";
import { type AgentImport, agentProfile, parseAgentFile } from "./agent-file";
import type { DesiredDomain, DesiredGuideline, DesiredPage, DesiredProject, DesiredTicket } from "./desired";

export type Desired = {
  project: DesiredProject & { folder: string };
  pages: DesiredPage[];
  domains: DesiredDomain[];
  tickets: DesiredTicket[];
  profiles: AgentImport[];
  guidelines: DesiredGuideline[];
  manifestVersions: Map<string, string>;
  notesDir: string;
};

const GUIDELINES_DIR = join(import.meta.dir, "..", "data", "guidelines");
const readGuideline = (...parts: string[]) => readFileSync(join(GUIDELINES_DIR, ...parts), "utf8");

function loadAgents(repoRoot: string): AgentImport[] {
  const dir = join(repoRoot, ".claude", "agents");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const agent = parseAgentFile(readFileSync(join(dir, f), "utf8"));
      const settings = AGENT_SETTINGS[agent.name];
      if (!settings) throw new KiboError("INVALID_INPUT", `no profile settings for agent ${agent.name}`);
      return agentProfile(agent, settings);
    });
}

function loadManifestVersions(repoRoot: string): Map<string, string> {
  const versions = new Map<string, string>();
  for (const id of new Set(PAGES.flatMap((p) => p.instances.map((i) => i.componentId)))) {
    const file = join(repoRoot, "components", id, "kibo.component.json");
    versions.set(id, ComponentManifest.parse(JSON.parse(readFileSync(file, "utf8"))).version);
  }
  return versions;
}

export function loadDesired(repoRoot: string, projectFolder: string): Desired {
  const domains = DOMAINS.map((d) => ({ name: d.name, guideline: readGuideline("domains", d.file) }));
  const profiles = loadAgents(repoRoot);
  const guidelines: DesiredGuideline[] = [
    {
      owner: { scope: "workspace" },
      path: GUIDELINE_PATHS.workspace,
      content: readGuideline("workspace", "conventions.md"),
    },
    { owner: { scope: "project" }, path: GUIDELINE_PATHS.project, content: readGuideline("project.md") },
    ...DOMAINS.map((d, i) => ({
      owner: { scope: "domain" as const, name: d.name },
      path: d.file,
      content: domains[i]?.guideline ?? "",
    })),
    ...profiles.map((p) => ({
      owner: { scope: "profile" as const, name: p.profile.name },
      path: GUIDELINE_PATHS.profile,
      content: p.guideline,
    })),
  ];
  return {
    project: { ...PROJECT, folder: projectFolder },
    pages: PAGES,
    domains,
    tickets: TICKETS,
    profiles,
    guidelines,
    manifestVersions: loadManifestVersions(repoRoot),
    notesDir: join(projectFolder, NOTES_SUBDIR),
  };
}
