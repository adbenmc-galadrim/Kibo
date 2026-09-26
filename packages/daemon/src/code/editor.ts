import { basename, isAbsolute } from "node:path";
import { KiboError } from "@kibo/schema";

export const ALLOWED_EDITORS: readonly string[] = [
  "code",
  "code-insiders",
  "cursor",
  "windsurf",
  "zed",
  "subl",
  "webstorm",
  "idea",
];
const GOTO_FLAG = new Set(["code", "code-insiders", "cursor", "windsurf"]);
const LINE_FLAG = new Set(["webstorm", "idea"]);

function lineArgs(name: string, file: string, line: number | null): string[] {
  if (line === null) return [file];
  if (GOTO_FLAG.has(name)) return ["--goto", `${file}:${line}`];
  if (LINE_FLAG.has(name)) return ["--line", String(line), file];
  return [`${file}:${line}`];
}

function configuredEditor(env: Record<string, string | undefined>): string {
  return (env.VISUAL || env.EDITOR || "").trim().split(/\s+/)[0] ?? "";
}

export function editorCommand(
  file: string,
  line: number | null,
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
): string[] {
  if (!isAbsolute(file)) throw new KiboError("INVALID_INPUT", `editor file must be absolute: ${file}`);
  const configured = configuredEditor(env);
  const name = basename(configured);
  if (configured && ALLOWED_EDITORS.includes(name)) return [configured, ...lineArgs(name, file, line)];
  if (platform === "darwin") return ["open", file];
  if (platform === "linux") return ["xdg-open", file];
  throw new KiboError("EDITOR_UNAVAILABLE", `no allowed editor on ${platform}`);
}

export function openInEditor(cmd: string[], env: Record<string, string> = {}): void {
  try {
    Bun.spawn(cmd, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "ignore"] }).unref();
  } catch (e) {
    throw new KiboError("EDITOR_UNAVAILABLE", `cannot start ${cmd[0]}: ${String(e)}`);
  }
}
