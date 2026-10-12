import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentManifest } from "@kibo/schema";
import { DOMAINS, GUIDELINE_PATHS, NOTES_SUBDIR, PAGES, PROJECT } from "../data/kibo";
import { TICKETS } from "../data/tickets";
import type { DesiredDomain, DesiredGuideline, DesiredPage, DesiredProject, DesiredTicket } from "./desired";

export type Desired = {
  project: DesiredProject & { folder: string };
  pages: DesiredPage[];
  domains: DesiredDomain[];
  tickets: DesiredTicket[];
  guidelines: DesiredGuideline[];
  manifestVersions: Map<string, string>;
  notesDir: string;
};

const GUIDELINES_DIR = join(import.meta.dir, "..", "data", "guidelines");
const readGuideline = (...parts: string[]) => readFileSync(join(GUIDELINES_DIR, ...parts), "utf8");

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
  ];
  return {
    project: { ...PROJECT, folder: projectFolder },
    pages: PAGES,
    domains,
    tickets: TICKETS,
    guidelines,
    manifestVersions: loadManifestVersions(repoRoot),
    notesDir: join(projectFolder, NOTES_SUBDIR),
  };
}
