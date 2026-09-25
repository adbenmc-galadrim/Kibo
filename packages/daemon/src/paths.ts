import { homedir } from "node:os";
import { join } from "node:path";

export function kiboHome(env: Record<string, string | undefined> = process.env): string {
  return env.KIBO_HOME ?? join(homedir(), ".kibo");
}
