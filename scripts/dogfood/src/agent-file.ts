import { AgentModel, KiboError, type ProfileInput } from "@kibo/schema";
import type { ProfileSettings } from "./desired";

export type AgentFile = { name: string; description: string; model: string; tools: string[]; body: string };
export type AgentImport = { profile: ProfileInput; guideline: string; gaps: string[] };

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const FALLBACK_MODEL = "opus";

function fields(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of block.split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) out.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  return out;
}

export function parseAgentFile(markdown: string): AgentFile {
  const match = FRONTMATTER.exec(markdown);
  if (!match) throw new KiboError("INVALID_INPUT", "agent file has no frontmatter");
  const meta = fields(match[1] ?? "");
  const name = meta.get("name");
  if (!name) throw new KiboError("INVALID_INPUT", "agent file has no name");
  const tools = meta.get("tools");
  return {
    name,
    description: meta.get("description") ?? "",
    model: meta.get("model") ?? FALLBACK_MODEL,
    tools: tools ? tools.split(",").map((t) => t.trim()) : [],
    body: (match[2] ?? "").trim(),
  };
}

export function agentProfile(agent: AgentFile, settings: ProfileSettings): AgentImport {
  const gaps: string[] = [];
  const model = AgentModel.safeParse(agent.model);
  if (!model.success) gaps.push(`${agent.name}: model ${agent.model} not supported, imported as opus`);
  if (agent.tools.length > 0)
    gaps.push(`${agent.name}: tools (${agent.tools.join(", ")}) not expressible in a profile`);
  return {
    profile: {
      name: agent.name,
      model: model.success ? model.data : FALLBACK_MODEL,
      execution: "cli",
      ...settings,
      subagents: [],
      enabled: true,
    },
    guideline: `# ${agent.name}\n\n${agent.description}\n\n${agent.body}\n`,
    gaps,
  };
}
