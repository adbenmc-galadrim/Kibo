import { realpathSync } from "node:fs";
import { basename, join, sep } from "node:path";

function realOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

export function transcriptRootOf(env: { CLAUDE_CONFIG_DIR?: string }, home: string): string {
  const config = env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  return join(config, "projects");
}

export function acceptedTranscriptPath(root: string, sessionId: string, path: string | null): string | null {
  if (path === null || basename(path) !== `${sessionId}.jsonl`) return null;
  const realRoot = realOrNull(root);
  const real = realOrNull(path);
  if (realRoot === null || real === null) return null;
  return real.startsWith(realRoot + sep) && basename(real) === basename(path) ? real : null;
}
