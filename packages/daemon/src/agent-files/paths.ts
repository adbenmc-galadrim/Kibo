import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { type AgentRef, type AgentScope, KiboError, parseAgentRef, systemAgentName } from "@kibo/schema";
import { isInside } from "../code/safe-path";

export type AgentRoots = { claudeHome: string; projectFolder(projectId: string): string | null };

const forbidden = (detail: string) => new KiboError("FORBIDDEN", detail);

function realAnchor(path: string): string {
  const rest: string[] = [];
  let current = path;
  while (lstatSync(current, { throwIfNoEntry: false }) === undefined) {
    const parent = dirname(current);
    if (parent === current) break;
    rest.unshift(basename(current));
    current = parent;
  }
  try {
    return join(realpathSync(current), ...rest);
  } catch (e) {
    throw forbidden(`${path} cannot be resolved: ${String(e)}`);
  }
}

export function boundedPath(root: string, target: string): string {
  const abs = resolve(target);
  if (!isInside(resolve(root), abs)) throw forbidden(`${target} leaves ${root}`);
  if (abs !== resolve(root) && lstatSync(abs, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw forbidden(`${target} is a symbolic link`);
  }
  const real = realAnchor(abs);
  if (!isInside(realAnchor(resolve(root)), real)) throw forbidden(`${target} resolves outside ${root}`);
  return real;
}

export async function assertInside(root: string, target: string): Promise<string> {
  return boundedPath(root, target);
}

export function agentsDir(roots: AgentRoots, scope: AgentScope, projectId: string | null): string | null {
  if (scope !== "project") return join(roots.claudeHome, "agents");
  const folder = projectId === null ? null : roots.projectFolder(projectId);
  return folder === null ? null : join(folder, ".claude", "agents");
}

export function requireAgentsDir(roots: AgentRoots, scope: AgentScope, projectId: string | null): string {
  const dir = agentsDir(roots, scope, projectId);
  if (dir === null) throw new KiboError("PROJECT_FOLDER_MISSING", `project ${projectId} has no local folder`);
  return dir;
}

export function agentFileName(ref: AgentRef): string {
  const parsed = parseAgentRef(ref);
  return parsed.scope === "system" ? systemAgentName(parsed.id) : parsed.name;
}

export function agentPath(roots: AgentRoots, ref: AgentRef): string {
  const parsed = parseAgentRef(ref);
  const dir = requireAgentsDir(roots, parsed.scope, parsed.scope === "project" ? parsed.projectId : null);
  const path = join(dir, `${agentFileName(ref)}.md`);
  boundedPath(dir, path);
  return path;
}
