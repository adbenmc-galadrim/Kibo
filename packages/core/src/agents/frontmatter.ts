import { AgentFile, type AgentFrontmatter, SkillFile, type SkillFrontmatter } from "@kibo/schema";
import { type KnownValue, parseFrontmatter, renderFrontmatter, splitFrontmatter } from "./frontmatter-yaml";

export { type ParsedFrontmatter, parseFrontmatter, renderFrontmatter } from "./frontmatter-yaml";

export const KNOWN_AGENT_KEYS = [
  "name",
  "description",
  "model",
  "tools",
  "disallowedTools",
  "skills",
] as const;
export const KNOWN_SKILL_KEYS = [
  "name",
  "description",
  "allowed-tools",
  "disable-model-invocation",
  "user-invocable",
] as const;
const AGENT_LISTS = ["tools", "disallowedTools", "skills"];
const AGENT_COMMA_KEYS = ["tools", "disallowedTools"];
const SKILL_LISTS = ["allowed-tools"];
const SKILL_BOOLS = ["disable-model-invocation", "user-invocable"];

type Known = Record<string, KnownValue>;

const text = (known: Known, key: string): string | undefined => {
  const value = known[key];
  return typeof value === "string" ? value : undefined;
};
const list = (known: Known, key: string): string[] | undefined => {
  const value = known[key];
  return Array.isArray(value) ? value : undefined;
};
const flag = (known: Known, key: string): boolean | undefined => {
  const value = known[key];
  return typeof value === "boolean" ? value : undefined;
};

const definedOnly = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));

function issueOf(error: { issues: { path: (string | number)[] }[] }): string {
  return `frontmatter illisible : ${error.issues[0]?.path.join(".") || "contenu"}`;
}

export function parseAgentFile(content: string): { file: AgentFile } | { problem: string } {
  const parsed = parseFrontmatter(content, KNOWN_AGENT_KEYS, AGENT_LISTS, []);
  if ("problem" in parsed) return parsed;
  if (text(parsed.known, "name") === undefined) return { problem: "frontmatter illisible : name manquant" };
  if (text(parsed.known, "description") === undefined) {
    return { problem: "frontmatter illisible : description manquante" };
  }
  const frontmatter = definedOnly({
    name: text(parsed.known, "name"),
    description: text(parsed.known, "description"),
    model: text(parsed.known, "model"),
    tools: list(parsed.known, "tools"),
    disallowedTools: list(parsed.known, "disallowedTools"),
    skills: list(parsed.known, "skills"),
    extra: parsed.extra,
    extraKeys: parsed.extraKeys,
  });
  const file = AgentFile.safeParse({ frontmatter, body: parsed.body });
  return file.success ? { file: file.data } : { problem: issueOf(file.error) };
}

export function renderAgentFile(file: AgentFile): string {
  const fm: AgentFrontmatter = file.frontmatter;
  return renderFrontmatter(
    {
      name: fm.name,
      description: fm.description,
      model: fm.model,
      tools: fm.tools,
      disallowedTools: fm.disallowedTools,
      skills: fm.skills,
    },
    KNOWN_AGENT_KEYS,
    AGENT_COMMA_KEYS,
    fm.extra,
    file.body,
  );
}

export function parseSkillFile(
  content: string,
  folderName: string,
): { file: SkillFile; name: string } | { problem: string } {
  if (splitFrontmatter(content) === null) {
    return { file: { frontmatter: { extra: "", extraKeys: [] }, body: content }, name: folderName };
  }
  const parsed = parseFrontmatter(content, KNOWN_SKILL_KEYS, SKILL_LISTS, SKILL_BOOLS);
  if ("problem" in parsed) return parsed;
  const frontmatter = definedOnly({
    name: text(parsed.known, "name"),
    description: text(parsed.known, "description"),
    allowedTools: list(parsed.known, "allowed-tools"),
    disableModelInvocation: flag(parsed.known, "disable-model-invocation"),
    userInvocable: flag(parsed.known, "user-invocable"),
    extra: parsed.extra,
    extraKeys: parsed.extraKeys,
  });
  const file = SkillFile.safeParse({ frontmatter, body: parsed.body });
  if (!file.success) return { problem: issueOf(file.error) };
  return { file: file.data, name: file.data.frontmatter.name ?? folderName };
}

const isEmpty = (fm: SkillFrontmatter): boolean =>
  fm.extra === "" &&
  [fm.name, fm.description, fm.allowedTools, fm.disableModelInvocation, fm.userInvocable].every(
    (v) => v === undefined,
  );

export function renderSkillFile(file: SkillFile): string {
  const fm = file.frontmatter;
  if (isEmpty(fm)) return file.body;
  return renderFrontmatter(
    {
      name: fm.name,
      description: fm.description,
      "allowed-tools": fm.allowedTools,
      "disable-model-invocation": fm.disableModelInvocation,
      "user-invocable": fm.userInvocable,
    },
    KNOWN_SKILL_KEYS,
    ["allowed-tools"],
    fm.extra,
    file.body,
  );
}
