import type { SkillFile } from "@kibo/schema";

export const SKILL_FILE = "SKILL.md";

export type SkillFields = {
  description: string;
  allowedTools: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
};

export type SkillText = { prefix: string; body: string };

const FENCE = "---";
const QUOTE_TRIGGER = /[:#"'\n\r\t\\]|^[\s\-?,[\]{}&*!|>%@`]|\s$/;
const RESERVED_WORDS = /^(true|false|yes|no|on|off|null|~|[-+]?\d[\d._]*(e[-+]?\d+)?)$/i;

const yamlString = (value: string): string =>
  value === "" || QUOTE_TRIGGER.test(value) || RESERVED_WORDS.test(value) ? JSON.stringify(value) : value;

export function splitSkillText(raw: string): SkillText {
  const lines = raw.split("\n");
  const end = lines[0] === FENCE ? lines.indexOf(FENCE, 1) : -1;
  if (end === -1) return { prefix: "", body: raw };
  const head = `${lines.slice(0, end + 1).join("\n")}\n`;
  const rest = raw.slice(head.length);
  return rest.startsWith("\n") ? { prefix: `${head}\n`, body: rest.slice(1) } : { prefix: head, body: rest };
}

export function splitTools(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[" || char === "{") depth += 1;
    if (char === ")" || char === "]" || char === "}") depth -= 1;
    if (char === "," && depth === 0) {
      items.push(current);
      current = "";
    } else current += char;
  }
  return [...items, current].map((item) => item.trim()).filter((item) => item !== "");
}

export function fieldsOf(file: SkillFile | null): SkillFields {
  const fm = file?.frontmatter;
  return {
    description: fm?.description ?? "",
    allowedTools: fm?.allowedTools?.join(", ") ?? "",
    disableModelInvocation: fm?.disableModelInvocation ?? false,
    userInvocable: fm?.userInvocable ?? true,
  };
}

const kept = <T>(value: T, fallback: T, original: T | undefined): T | undefined =>
  original === undefined && value === fallback ? undefined : value;

function frontmatterLines(fields: SkillFields, file: SkillFile | null): string[] {
  const fm = file?.frontmatter;
  const tools = splitTools(fields.allowedTools);
  const description = kept(fields.description.trim(), "", fm?.description);
  const allowed = fm?.allowedTools === undefined && tools.length === 0 ? undefined : tools;
  const disable = kept(fields.disableModelInvocation, false, fm?.disableModelInvocation);
  const invocable = kept(fields.userInvocable, true, fm?.userInvocable);
  return [
    ...(fm?.name !== undefined ? [`name: ${yamlString(fm.name)}`] : []),
    ...(description !== undefined ? [`description: ${yamlString(description)}`] : []),
    ...(allowed !== undefined
      ? [allowed.length === 0 ? "allowed-tools: []" : `allowed-tools: ${yamlString(allowed.join(", "))}`]
      : []),
    ...(disable !== undefined ? [`disable-model-invocation: ${disable}`] : []),
    ...(invocable !== undefined ? [`user-invocable: ${invocable}`] : []),
    ...(fm?.extra ? [fm.extra] : []),
  ];
}

export function composeSkillText(
  input: SkillText & { fields: SkillFields | null; file: SkillFile | null },
): string {
  if (input.fields === null) return input.prefix + input.body;
  const head = frontmatterLines(input.fields, input.file);
  if (head.length === 0) return input.body;
  return `${[FENCE, ...head, FENCE, ""].join("\n")}${input.body === "" ? "" : `\n${input.body}`}`;
}

export const sameFields = (a: SkillFields, b: SkillFields): boolean =>
  a.description === b.description &&
  a.allowedTools === b.allowedTools &&
  a.disableModelInvocation === b.disableModelInvocation &&
  a.userInvocable === b.userInvocable;
