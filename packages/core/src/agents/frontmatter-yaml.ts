export type KnownValue = string | string[] | boolean;
export type ParsedFrontmatter =
  | { known: Record<string, KnownValue>; extra: string; extraKeys: string[]; body: string }
  | { problem: string };
export type FrontmatterKeys = {
  known: readonly string[];
  lists: readonly string[];
  bools: readonly string[];
};

type Group = { key: string | null; first: string; rest: string; lines: string[] };
type Value = { ok: KnownValue | null } | { problem: string };

const FENCE = "---";
const TOP_KEY = /^([^\s#:][^:]*?):(?:\s+(.*))?$/s;
const QUOTE_TRIGGER = /[:#"'\n\r\t\\]|^[\s\-?,[\]{}&*!|>%@`]|\s$/;
const RESERVED_WORDS = /^(true|false|yes|no|on|off|null|~|[-+]?\d[\d._]*(e[-+]?\d+)?)$/i;

export const unreadable = (key: string): { problem: string } => ({
  problem: `frontmatter illisible : ${key}`,
});

export function splitFrontmatter(text: string): { head: string[]; body: string } | null | "open" {
  const lines = text.split("\n");
  if (lines[0] !== FENCE) return null;
  const end = lines.indexOf(FENCE, 1);
  if (end === -1) return "open";
  const rest = lines.slice(end + 1).join("\n");
  return { head: lines.slice(1, end), body: rest.startsWith("\n") ? rest.slice(1) : rest };
}

const isContinuation = (line: string): boolean =>
  line.trim() === "" || /^\s/.test(line) || line.startsWith("#") || line.startsWith("- ") || line === "-";

function groupLines(head: readonly string[]): Group[] | { problem: string } {
  const groups: Group[] = [];
  for (const line of head) {
    const last = groups.at(-1);
    if (isContinuation(line)) {
      if (last) last.lines.push(line);
      else groups.push({ key: null, first: line, rest: "", lines: [line] });
      continue;
    }
    const match = TOP_KEY.exec(line);
    if (!match?.[1]) return unreadable(`ligne « ${line.slice(0, 40)} »`);
    groups.push({ key: match[1].trim(), first: line, rest: (match[2] ?? "").trim(), lines: [line] });
  }
  return groups;
}

const stripComment = (value: string): string => value.replace(/\s+#.*$/, "");

function unquote(raw: string): string | null {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) return null;
    const inner = value.slice(1, -1);
    return inner.replaceAll("''", "").includes("'") ? null : inner.replaceAll("''", "'");
  }
  return stripComment(value).trim();
}

export function splitTopLevel(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      items.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current);
  return items.map((i) => i.trim()).filter((i) => i.length > 0);
}

const isMapping = (raw: string): boolean => !/^["']/.test(raw.trim()) && /:(\s|$)/.test(raw);

function listItems(items: readonly string[]): string[] | null {
  if (items.some(isMapping)) return null;
  const values = items.map(unquote);
  return values.some((v) => v === null || v.length === 0) ? null : values.filter(isText);
}

const isText = (v: string | null): v is string => v !== null;

function blockScalar(indicator: string, lines: readonly string[]): string {
  const filled = lines.filter((l) => l.trim() !== "");
  const indent = Math.min(...filled.map((l) => l.length - l.trimStart().length));
  const dedented = lines
    .map((l) => l.slice(indent))
    .join("\n")
    .replace(/\n+$/, "");
  return indicator.startsWith(">") ? dedented.replace(/([^\n])\n(?!\n)/g, "$1 ") : dedented;
}

function scalarValue(group: Group, raw: readonly string[], more: readonly string[]): Value {
  if (/^[|>][-+]?$/.test(group.rest)) {
    return more.length === 0 ? { ok: "" } : { ok: blockScalar(group.rest, raw) };
  }
  if (more.length > 0 && !group.rest.startsWith('"') && !group.rest.startsWith("'")) {
    return { ok: [stripComment(group.rest), ...more.map((l) => stripComment(l.trim()))].join(" ") };
  }
  if (more.length > 0) return unreadable(group.key ?? "");
  const value = unquote(group.rest);
  return value === null ? unreadable(group.key ?? "") : { ok: value };
}

function listValue(group: Group, more: readonly string[]): Value {
  const key = group.key ?? "";
  if (group.rest === "") {
    const items = more.map((l) => /^\s*-\s+(.*)$/.exec(l)?.[1] ?? null);
    if (items.some((i) => i === null)) return unreadable(key);
    const values = listItems(items.filter(isText));
    return values === null ? unreadable(key) : { ok: values };
  }
  if (more.length > 0) return unreadable(key);
  if (group.rest.startsWith("{")) return unreadable(key);
  const inline = group.rest.startsWith("[")
    ? group.rest.endsWith("]")
      ? group.rest.slice(1, -1)
      : null
    : null;
  if (group.rest.startsWith("[") && inline === null) return unreadable(key);
  const scalar = inline === null ? unquote(group.rest) : inline;
  if (scalar === null) return unreadable(key);
  const values = listItems(splitTopLevel(scalar));
  return values === null ? unreadable(key) : { ok: values };
}

function boolValue(group: Group, more: readonly string[]): Value {
  const value = more.length === 0 ? stripComment(group.rest).trim().toLowerCase() : "";
  if (value === "true") return { ok: true };
  if (value === "false") return { ok: false };
  return unreadable(group.key ?? "");
}

function knownValue(group: Group, keys: FrontmatterKeys): Value {
  const more = group.lines.slice(1).filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"));
  if (group.rest === "" && more.length === 0) return { ok: null };
  const key = group.key ?? "";
  if (keys.lists.includes(key)) return listValue(group, more);
  if (keys.bools.includes(key)) return boolValue(group, more);
  if (group.rest === "" || group.rest.startsWith("[") || group.rest.startsWith("{")) return unreadable(key);
  return scalarValue(group, group.lines.slice(1), more);
}

export function parseFrontmatter(
  text: string,
  knownKeys: readonly string[],
  listKeys: readonly string[],
  boolKeys: readonly string[],
): ParsedFrontmatter {
  const keys: FrontmatterKeys = { known: knownKeys, lists: listKeys, bools: boolKeys };
  const split = splitFrontmatter(text);
  if (split === null) return { problem: "frontmatter manquant" };
  if (split === "open") return { problem: "frontmatter non fermé" };
  const groups = groupLines(split.head);
  if ("problem" in groups) return groups;
  const known: Record<string, KnownValue> = {};
  const extra: string[] = [];
  const extraKeys: string[] = [];
  for (const group of groups) {
    if (group.key === null || !keys.known.includes(group.key)) {
      extra.push(...group.lines);
      if (group.key !== null) extraKeys.push(group.key);
      continue;
    }
    if (group.key in known) return unreadable(`${group.key} en double`);
    const value = knownValue(group, keys);
    if ("problem" in value) return value;
    if (value.ok !== null) known[group.key] = value.ok;
  }
  return { known, extra: extra.join("\n"), extraKeys, body: split.body };
}

const needsQuote = (value: string): boolean =>
  value === "" || QUOTE_TRIGGER.test(value) || RESERVED_WORDS.test(value);
export const yamlString = (value: string): string => (needsQuote(value) ? JSON.stringify(value) : value);

function renderValue(key: string, value: KnownValue, commaKeys: readonly string[]): string {
  if (typeof value === "boolean") return `${key}: ${value}`;
  if (typeof value === "string") return `${key}: ${yamlString(value)}`;
  if (value.length === 0) return `${key}: []`;
  const commaSafe = value.every((v) => splitTopLevel(v).length === 1 && splitTopLevel(v)[0] === v);
  if (commaKeys.includes(key) && commaSafe) return `${key}: ${yamlString(value.join(", "))}`;
  return [`${key}:`, ...value.map((v) => `  - ${yamlString(v)}`)].join("\n");
}

export function renderFrontmatter(
  known: Record<string, KnownValue | undefined>,
  order: readonly string[],
  commaKeys: readonly string[],
  extra: string,
  body: string,
): string {
  const lines = order.flatMap((key) => {
    const value = known[key];
    return value === undefined ? [] : [renderValue(key, value, commaKeys)];
  });
  const head = [...lines, ...(extra === "" ? [] : [extra])];
  return [FENCE, ...head, FENCE, ""].join("\n") + (body === "" ? "" : `\n${body}`);
}
