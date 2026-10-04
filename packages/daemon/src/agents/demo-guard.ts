import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { GuardDecision, RunView } from "@kibo/schema";
import { MAX_TEXT } from "./hook-payload";
import { DEMO_PROFILE_ID, type ToolGuard } from "./orchestrator-types";

const PATH_KEYS = ["file_path", "notebook_path", "path"] as const;
const DENIED: GuardDecision = { decision: "deny", reason: "the demo agent stays in its workspace" };

function realTarget(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(realTarget(parent), basename(path));
}

const inside = (root: string, path: string) => path === root || path.startsWith(root + sep);

export function demoWorkspaceGuard(cwd: string, readsBrief: boolean): ToolGuard {
  const root = realpathSync(cwd);
  const brief = join(dirname(root), "brief.md");
  return ({ tool, input }) => {
    const values = PATH_KEYS.flatMap((key) => (input && Object.hasOwn(input, key) ? [input[key]] : []));
    const texts = values.filter((v): v is string => typeof v === "string" && v.length < MAX_TEXT);
    if (texts.length !== values.length) return DENIED;
    const paths = texts.map((value) => realTarget(resolve(root, value)));
    const allowed = (path: string) => inside(root, path) || (readsBrief && tool === "Read" && path === brief);
    return paths.every(allowed) ? null : DENIED;
  };
}

export function demoRunGuard(run: Pick<RunView, "profileId" | "cwd" | "ticketId">): ToolGuard | null {
  if (run.profileId !== DEMO_PROFILE_ID) return null;
  return run.cwd === null ? () => DENIED : demoWorkspaceGuard(run.cwd, run.ticketId !== null);
}
