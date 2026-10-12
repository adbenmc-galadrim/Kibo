import type { AgentFile } from "@kibo/schema";

const NEEDS_QUOTES = /[:#"\n]|^[\s\-?[\]{}!&*|>'%@`,]|\s$/;

const scalar = (value: string): string => (NEEDS_QUOTES.test(value) ? JSON.stringify(value) : value);

export function agentFileText(file: AgentFile): string {
  const fm = file.frontmatter;
  const lines = ["---", `name: ${fm.name}`, `description: ${scalar(fm.description)}`];
  if (fm.model) lines.push(`model: ${fm.model}`);
  if (fm.tools) lines.push(`tools: ${fm.tools.join(", ")}`);
  if (fm.disallowedTools) lines.push(`disallowedTools: ${fm.disallowedTools.join(", ")}`);
  if (fm.skills) lines.push("skills:", ...fm.skills.map((s) => `  - ${s}`));
  const extra = fm.extra === "" || fm.extra.endsWith("\n") ? fm.extra : `${fm.extra}\n`;
  return `${lines.join("\n")}\n${extra}---\n\n${file.body}`;
}
