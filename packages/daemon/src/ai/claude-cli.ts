import type { AiStatus } from "@kibo/schema";
import type { AiAvailability, ClaudeCapabilities, Exec } from "./ports";

export type ClaudeProbe = {
  found: boolean;
  version: string | null;
  loggedIn: boolean | null;
  capabilities: ClaudeCapabilities | null;
};

export const CLAUDE_BUILTIN_TOOLS = [
  "Agent",
  "Bash",
  "BashOutput",
  "Edit",
  "ExitPlanMode",
  "Glob",
  "Grep",
  "KillShell",
  "MultiEdit",
  "NotebookEdit",
  "Read",
  "SlashCommand",
  "Task",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "Write",
] as const;
const GENERATOR_TOOLS: readonly string[] = ["Read", "Edit", "Write", "Glob", "Grep", "Bash"];
const WEB_TOOLS = ["WebFetch", "WebSearch"];
const PROBE_TIMEOUT_MS = 10_000;

const escapeRegExp = (s: string) => s.replace(/[-.*+?^${}()|[\]\\]/g, "\\$&");

function optionBlock(help: string, name: string): string | null {
  const start = new RegExp(`^ {2}(?:-\\w, )?(?:--[\\w-]+, )?${escapeRegExp(name)}(?=[\\s,]|$)`, "m").exec(
    help,
  );
  if (!start) return null;
  const rest = help.slice(start.index + start[0].length);
  const next = rest.search(/\n {2}(?:-\w, )?--[\w-]/);
  return next === -1 ? rest : rest.slice(0, next);
}

export function parseHelp(help: string): ClaudeCapabilities {
  return {
    tools: optionBlock(help, "--tools") !== null,
    jsonSchema: optionBlock(help, "--json-schema") !== null,
    strictMcp: optionBlock(help, "--strict-mcp-config") !== null,
    noSessionPersistence: optionBlock(help, "--no-session-persistence") !== null,
  };
}

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

export async function probeClaude(exec: Exec, bin: string): Promise<ClaudeProbe> {
  const version = await exec([bin, "--version"], PROBE_TIMEOUT_MS);
  if (!version || version.code !== 0)
    return { found: false, version: null, loggedIn: null, capabilities: null };
  const help = await exec([bin, "--help"], PROBE_TIMEOUT_MS);
  const auth = await exec([bin, "auth", "status", "--json"], PROBE_TIMEOUT_MS);
  return {
    found: true,
    version: parseVersion(version.stdout),
    loggedIn: auth ? parseAuthStatus(auth.stdout) : null,
    capabilities: parseHelp(help && help.code === 0 ? help.stdout : ""),
  };
}

const strict = (caps: ClaudeCapabilities) => (caps.strictMcp ? ["--strict-mcp-config"] : []);

export function assistantArgs(caps: ClaudeCapabilities, jsonSchema: string): string[] {
  return [
    ...(caps.tools ? ["--tools", ""] : ["--disallowedTools", CLAUDE_BUILTIN_TOOLS.join(",")]),
    ...(caps.jsonSchema ? ["--json-schema", jsonSchema] : []),
    ...strict(caps),
    ...(caps.noSessionPersistence ? ["--no-session-persistence"] : []),
  ];
}

export function generatorArgs(caps: ClaudeCapabilities): string[] {
  const denied = caps.tools ? WEB_TOOLS : CLAUDE_BUILTIN_TOOLS.filter((t) => !GENERATOR_TOOLS.includes(t));
  return [
    ...(caps.tools ? ["--tools", GENERATOR_TOOLS.join(",")] : []),
    "--allowedTools",
    "Bash(kibo component test:*)",
    "--disallowedTools",
    denied.join(","),
    ...strict(caps),
  ];
}

export function createAiAvailability(deps: {
  probe: () => Promise<ClaudeProbe>;
  profileEnabled: (id: "assistant" | "generateur") => boolean;
}): AiAvailability {
  let probe: ClaudeProbe = { found: false, version: null, loggedIn: null, capabilities: null };
  const status = (): AiStatus => {
    const profiles = {
      assistant: deps.profileEnabled("assistant"),
      generateur: deps.profileEnabled("generateur"),
    };
    if (!probe.found) return { available: false, reason: "missing", version: null, loggedIn: null, profiles };
    if (probe.loggedIn === false)
      return { available: false, reason: "logged_out", version: probe.version, loggedIn: false, profiles };
    return { available: true, reason: null, version: probe.version, loggedIn: probe.loggedIn, profiles };
  };
  let detecting: Promise<AiStatus> | null = null;
  const refresh = () => {
    const detection = deps.probe().then((found) => {
      probe = found;
      return status();
    });
    const forget = () => {
      if (detecting === detection) detecting = null;
    };
    detecting = detection;
    detection.then(forget, forget);
    return detection;
  };
  return {
    status,
    capabilities: () => probe.capabilities,
    refresh,
    settled: () => detecting ?? Promise.resolve(status()),
  };
}
