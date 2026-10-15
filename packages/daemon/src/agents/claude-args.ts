import {
  AllowRules,
  ASK_TOOLS,
  HookEventName,
  KiboError,
  type PermissionMode,
  PROJECT_AGENT_MCP_TOOLS,
  TICKET_MCP_TOOLS,
} from "@kibo/schema";
import { tryKill } from "../process-group";
import type { McpTools } from "./ask-mcp";
import { type AgentFlags, agentArgs, checkedSkillRules, reservedAgentArgs } from "./cli-flags";
import { type HookLauncher, hookShellCommand, mcpServerConfig } from "./hook-launcher";
import type { LaunchInput } from "./run-process";

export type CliCaps = { permissionModes: string[] };

const TOOL_EVENTS = new Set<string>(["PreToolUse", "PostToolUse"]);

const isKiboTool = (rule: string) =>
  TICKET_MCP_TOOLS.includes(rule) || PROJECT_AGENT_MCP_TOOLS.includes(rule);

function profileRules(allow: readonly string[]): string[] {
  const rules = AllowRules.safeParse(allow.filter((rule) => !isKiboTool(rule)));
  if (!rules.success)
    throw new KiboError("INVALID_INPUT", "the profile carries an unsafe or malformed permission rule");
  const kiboTools = allow.filter((rule) => PROJECT_AGENT_MCP_TOOLS.includes(rule));
  return [...new Set([...kiboTools, ...rules.data])];
}

const baseTools = (tools: McpTools): readonly string[] => (tools === "ticket" ? TICKET_MCP_TOOLS : ASK_TOOLS);

export function claudeSettings(
  hook: HookLauncher,
  allow: readonly string[] = [],
  deny: readonly string[] = [],
  tools: McpTools = null,
  skillRules: readonly string[] = [],
): string {
  const rules = [...profileRules(allow), ...checkedSkillRules(skillRules)];
  const command = hookShellCommand(hook);
  const hooks = Object.fromEntries(
    HookEventName.options.map((event) => [
      event,
      [
        {
          ...(TOOL_EVENTS.has(event) ? { matcher: "*" } : {}),
          hooks: [{ type: "command", command, timeout: 10 }],
        },
      ],
    ]),
  );
  const permissions = {
    allow: [...baseTools(tools), ...rules],
    ...(deny.length > 0 ? { deny: [...deny] } : {}),
  };
  return JSON.stringify({ hooks, permissions });
}

const RESERVED_ARGS = new Set([
  "--dangerously-skip-permissions",
  "--allow-dangerously-skip-permissions",
  "--permission-mode",
  "--permission-prompts",
  "--settings",
  "--mcp-config",
  "--session-id",
  "--resume",
  "--add-dir",
]);

type ArgsInput = Pick<
  LaunchInput,
  | "model"
  | "permissionFlag"
  | "extraArgs"
  | "sessionId"
  | "resume"
  | "systemPromptFile"
  | "hook"
  | "allow"
  | "deny"
  | "mcpConfigFile"
  | "mcpTools"
  | "addDirs"
> & { agentFlags?: AgentFlags; isolated?: boolean };

const ISOLATION_ARGS = ["--setting-sources", "project,local", "--strict-mcp-config"];

export function claudeArgs(input: ArgsInput): string[] {
  const reserved = new Set([
    ...RESERVED_ARGS,
    ...reservedAgentArgs(input.agentFlags),
    ...(input.isolated ? ["--setting-sources"] : []),
  ]);
  const refused = input.extraArgs.find(
    (a) => reserved.has(a.split("=")[0] ?? a) || a.includes("bypassPermissions"),
  );
  if (refused) throw new KiboError("INVALID_INPUT", `argument ${refused} is reserved to Kibo`);
  const [first] = input.extraArgs;
  if (first !== undefined && !first.startsWith("-"))
    throw new KiboError("INVALID_INPUT", `extra arguments must start with a flag, not ${first}`);
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    ...(input.permissionFlag ? ["--permission-mode", input.permissionFlag] : []),
    "--permission-prompts",
    "none",
    "--model",
    input.model,
    "--settings",
    claudeSettings(input.hook, input.allow, input.deny, input.mcpTools, input.agentFlags?.skillRules),
    "--mcp-config",
    input.mcpConfigFile ?? mcpServerConfig(input.hook),
    ...(input.isolated ? ISOLATION_ARGS : []),
    "--append-system-prompt-file",
    input.systemPromptFile,
    ...agentArgs(input.agentFlags, input.resume),
    ...input.extraArgs,
    ...(input.addDirs.length > 0 ? ["--add-dir", ...input.addDirs] : []),
    ...(input.resume ? ["--resume", input.sessionId] : ["--session-id", input.sessionId]),
  ];
}

export function parseHelp(text: string): CliCaps {
  const block = /--permission-mode[\s\S]*?\(choices:([^)]*)\)/.exec(text)?.[1] ?? "";
  return { permissionModes: [...block.matchAll(/"([^"]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : [])) };
}

export async function readCliCaps(claudeBin: string, env: Record<string, string>): Promise<CliCaps> {
  const proc = Bun.spawn([claudeBin, "--help"], { env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => tryKill(`stopping ${claudeBin} --help`, () => proc.kill()), 5000);
  const [text, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  clearTimeout(timer);
  if (code !== 0) throw new KiboError("AGENT_CLI_NOT_FOUND", `${claudeBin} --help exited with ${code}`);
  return parseHelp(text);
}

export function permissionFlag(mode: PermissionMode, caps: CliCaps): string | null {
  const known = caps.permissionModes;
  if (known.length === 0) return mode === "default" ? null : mode;
  if (known.includes(mode)) return mode;
  if (mode === "default" && known.includes("manual")) return "manual";
  throw new KiboError("INVALID_INPUT", `the installed claude CLI does not accept --permission-mode ${mode}`);
}
