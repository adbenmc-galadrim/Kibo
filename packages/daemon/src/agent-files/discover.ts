import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseAgentFile } from "@kibo/core/agents/frontmatter";
import {
  type Agent,
  type AgentFile,
  AgentName,
  AgentRef,
  type AgentScope,
  agentNameProblem,
  agentRef,
  isReservedAgentName,
  systemAgentRef,
  systemIdOfName,
} from "@kibo/schema";
import { readWithHash } from "./guarded-write";
import { type AgentRoots, agentsDir, boundedPath, projectAgentsDir } from "./paths";

export type DiscoveredAgent = Omit<Agent, "settings" | "activeRuns" | "shadowedBy"> & {
  content: string | null;
};
export type ProjectFolderRef = { id: string; folder: string | null };

type Located = {
  ref: AgentRef;
  scope: AgentScope;
  projectId: string | null;
  name: string;
  path: string;
  dir: string;
};

const SCOPE_ORDER: Record<AgentScope, number> = { global: 0, project: 1, system: 2 };
const NAME_MISMATCH = "le nom du fichier et le champ name diffèrent";
const RESERVED = "nom réservé, ignoré";
const SYMLINK = "lien symbolique refusé";

async function markdownNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith(".md"))
      .map((e) => e.name.slice(0, -3))
      .sort();
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR")) {
      return [];
    }
    throw e;
  }
}

function locate(dir: string, name: string, projectId: string | null): Located | null {
  const path = join(dir, `${name}.md`);
  if (!AgentName.safeParse(name).success) {
    console.error(`[kibo-daemon] agent file ${path} ignored: invalid name`);
    return null;
  }
  const systemId = projectId === null ? systemIdOfName(name) : null;
  const scope: AgentScope = systemId ? "system" : projectId === null ? "global" : "project";
  const ref = AgentRef.safeParse(systemId ? systemAgentRef(systemId) : agentRef(scope, projectId, name));
  if (!ref.success) {
    console.error(`[kibo-daemon] agent file ${path} ignored: invalid reference`);
    return null;
  }
  return { ref: ref.data, scope, projectId, name, path, dir };
}

function fileProblem(loc: Located, file: AgentFile): string | null {
  if (loc.scope === "project" && isReservedAgentName(loc.name)) return RESERVED;
  return file.frontmatter.name === loc.name ? null : NAME_MISMATCH;
}

async function readAgent(loc: Located): Promise<DiscoveredAgent> {
  const base = {
    ref: loc.ref,
    scope: loc.scope,
    projectId: loc.projectId,
    name: loc.name,
    path: loc.path,
    nameWarning: loc.scope === "system" ? null : agentNameProblem(loc.name),
  };
  try {
    boundedPath(loc.dir, loc.path);
  } catch {
    return { ...base, hash: null, file: null, problem: SYMLINK, modifiedAt: null, content: null };
  }
  const read = await readWithHash(loc.path);
  if (read === null)
    return {
      ...base,
      hash: null,
      file: null,
      problem: "fichier introuvable",
      modifiedAt: null,
      content: null,
    };
  const parsed = parseAgentFile(read.content);
  const problem = "problem" in parsed ? parsed.problem : fileProblem(loc, parsed.file);
  const file = "file" in parsed && problem === null ? parsed.file : null;
  return { ...base, hash: read.hash, file, problem, modifiedAt: read.modifiedAt, content: read.content };
}

async function locateIn(dir: string | null, projectId: string | null): Promise<Located[]> {
  if (dir === null) return [];
  const names = await markdownNames(dir);
  return names.map((name) => locate(dir, name, projectId)).filter((l): l is Located => l !== null);
}

export function safeProjectAgentsDir(project: ProjectFolderRef): string | null {
  if (project.folder === null) return null;
  try {
    return projectAgentsDir(project.folder);
  } catch (e) {
    console.error(`[kibo-daemon] agents of project ${project.id} ignored: ${String(e)}`);
    return null;
  }
}

const compare = (a: DiscoveredAgent, b: DiscoveredAgent): number =>
  SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
  (a.projectId ?? "").localeCompare(b.projectId ?? "") ||
  a.name.localeCompare(b.name);

export async function discoverAgents(
  roots: AgentRoots,
  projects: readonly ProjectFolderRef[],
): Promise<DiscoveredAgent[]> {
  const located = [
    ...(await locateIn(agentsDir(roots, "global", null), null)),
    ...(await Promise.all(projects.map((p) => locateIn(safeProjectAgentsDir(p), p.id)))).flat(),
  ];
  const agents = await Promise.all(located.map(readAgent));
  return agents.sort(compare);
}
