import { dirname, join } from "node:path";

export function demoAgentBin(execPath = process.execPath, dir = import.meta.dir): string {
  if (dir.startsWith("/$bunfs")) return join(dirname(execPath), "kibo-demo-agent");
  return join(dir, "../agents/fake-claude.ts");
}
