import { type AiStatus, KiboError } from "@kibo/schema";
import { resolveClaudeBin } from "../runs/run-process";

export type ExecResult = { code: number; stdout: string; stderr: string };
export type Exec = (argv: string[], timeoutMs: number) => Promise<ExecResult | null>;

const PROBE_TIMEOUT_MS = 10_000;
const NO_PROFILES: AiStatus["profiles"] = { assistant: false, generateur: false };

export function parseVersion(out: string): string | null {
  return /(\d+\.\d+\.\d+)/.exec(out)?.[1] ?? null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function parseAuthStatus(out: string): boolean | null {
  const value = parseJson(out.trim());
  if (typeof value !== "object" || value === null || !("loggedIn" in value)) return null;
  return typeof value.loggedIn === "boolean" ? value.loggedIn : null;
}

export function claudeBinOrNull(
  configured: string | null,
  env: Record<string, string | undefined>,
): string | null {
  try {
    return resolveClaudeBin(configured, env);
  } catch (e) {
    if (e instanceof KiboError && e.code === "AGENT_CLI_NOT_FOUND") return null;
    throw e;
  }
}

export async function claudeStatus(exec: Exec, bin: string | null): Promise<AiStatus> {
  const version = bin ? await exec([bin, "--version"], PROBE_TIMEOUT_MS) : null;
  if (!bin || !version || version.code !== 0)
    return { available: false, reason: "missing", version: null, loggedIn: null, profiles: NO_PROFILES };
  const auth = await exec([bin, "auth", "status", "--json"], PROBE_TIMEOUT_MS);
  const loggedIn = auth ? parseAuthStatus(auth.stdout) : null;
  const found = parseVersion(version.stdout);
  if (loggedIn === false)
    return { available: false, reason: "logged_out", version: found, loggedIn, profiles: NO_PROFILES };
  return { available: true, reason: null, version: found, loggedIn, profiles: NO_PROFILES };
}
