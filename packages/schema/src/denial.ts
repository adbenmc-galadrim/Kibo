import { isSafeAddDir } from "./add-dir";
import { isSafeAllowRule } from "./allow-rule";

export type DenialReason = "ok" | "shell" | "mcp" | "unknown";
export type DenialItem = {
  tool: string;
  target: string;
  rule: string | null;
  addDir: string | null;
  reason: DenialReason;
};
export type RunDenials = {
  runId: string;
  turn: number;
  items: DenialItem[];
  questionId: string | null;
  at: number;
};
export type DeniedAction = { tool: string; target: string | null };
export type DenialContext = { home: string; cwd: string; known: readonly string[] };

export const DENIAL_ITEMS_MAX = 20;
export const DENIAL_TARGET_MAX = 500;

const CLAUDE_DENIAL = /Permission for this tool use was denied|requires approval/i;
const KIBO_DENIAL = /non autorisé par Kibo/i;
export const isClaudeDenial = (detail: string | null): boolean =>
  detail !== null && CLAUDE_DENIAL.test(detail) && !KIBO_DENIAL.test(detail);

const PATH_TOOLS = ["Read", "Glob", "Grep", "LS"];
const EDIT_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const OPERATORS = ["&&", "||", ";", "|", "\n"];

type Quote = "none" | "single" | "double";

function nextQuote(quote: Quote, char: string): Quote {
  if (quote === "single") return char === "'" ? "none" : "single";
  if (quote === "double") return char === '"' ? "none" : "double";
  if (char === "'") return "single";
  return char === '"' ? "double" : "none";
}

export function splitCommand(command: string): string[] {
  const parts: string[] = [];
  let quote: Quote = "none";
  let current = "";
  for (let i = 0; i < command.length; i++) {
    const char = command.charAt(i);
    if (char === "\\" && quote !== "single") {
      current += command.slice(i, i + 2);
      i++;
      continue;
    }
    const operator = quote === "none" ? OPERATORS.find((op) => command.startsWith(op, i)) : undefined;
    if (operator !== undefined) {
      parts.push(current);
      current = "";
      i += operator.length - 1;
      continue;
    }
    quote = nextQuote(quote, char);
    current += char;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

const bounded = (target: string): string => target.slice(0, DENIAL_TARGET_MAX);
const item = (tool: string, target: string, over: Partial<DenialItem>): DenialItem => ({
  tool,
  target: bounded(target),
  rule: null,
  addDir: null,
  reason: "unknown",
  ...over,
});

function bashItems(command: string): DenialItem[] {
  return splitCommand(command).map((simple) => {
    const word = simple.split(/\s+/).find((w) => !ASSIGNMENT.test(w));
    const rule = word === undefined ? null : `Bash(${word} *)`;
    return rule !== null && isSafeAllowRule(rule)
      ? item("Bash", simple, { rule, reason: "ok" })
      : item("Bash", simple, { reason: "shell" });
  });
}

const within = (path: string, dir: string): boolean =>
  path === dir || path.startsWith(`${dir.replace(/\/+$/, "")}/`);
const parentOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf("/"), 1));

function pathItems(tool: string, target: string, ctx: DenialContext): DenialItem[] {
  const path = target.startsWith("~/") ? `${ctx.home}${target.slice(1)}` : target;
  if (!path.startsWith("/") || within(path, ctx.cwd)) return [];
  const known = ctx.known.filter((k) => within(path, k)).sort((a, b) => b.length - a.length)[0];
  const dir = known ?? parentOf(path);
  return isSafeAddDir(dir, ctx.home)
    ? [item(tool, target, { addDir: dir, reason: "ok" })]
    : [item(tool, target, { reason: "unknown" })];
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

function webFetchItem(target: string): DenialItem {
  const host = hostOf(target);
  const rule = host === null ? null : `WebFetch(domain:${host})`;
  return rule !== null && isSafeAllowRule(rule)
    ? item("WebFetch", target, { rule, reason: "ok" })
    : item("WebFetch", target, { reason: "unknown" });
}

function itemsOf(action: DeniedAction, ctx: DenialContext): DenialItem[] {
  const { tool } = action;
  const target = action.target ?? "";
  if (tool === "Bash") return bashItems(target);
  if (PATH_TOOLS.includes(tool)) return pathItems(tool, target, ctx);
  if (EDIT_TOOLS.includes(tool)) return [item(tool, target, { rule: tool, reason: "ok" })];
  if (tool === "WebFetch") return [webFetchItem(target)];
  if (tool === "WebSearch") return [item(tool, target, { rule: "WebSearch", reason: "ok" })];
  if (tool.startsWith("mcp__")) return [item(tool, target, { reason: "mcp" })];
  return [item(tool, target, { reason: "unknown" })];
}

const identity = (i: DenialItem): string =>
  i.rule ?? (i.addDir ? `dir:${i.addDir}` : `${i.tool}:${i.target}`);

export function proposeRules(actions: readonly DeniedAction[], ctx: DenialContext): DenialItem[] {
  const seen = new Map<string, DenialItem>();
  for (const action of actions) {
    for (const candidate of itemsOf(action, ctx)) {
      if (seen.size >= DENIAL_ITEMS_MAX) return [...seen.values()];
      if (!seen.has(identity(candidate))) seen.set(identity(candidate), candidate);
    }
  }
  return [...seen.values()];
}

const quoted = (values: readonly string[]): string => values.map((v) => `\`${v}\``).join(", ");

export const RESUME_AFTER_ALLOW = (rules: readonly string[], dirs: readonly string[]): string => {
  const parts = [
    ...(rules.length > 0 ? [`les règles ${quoted(rules)}`] : []),
    ...(dirs.length > 0 ? [`les dossiers ${quoted(dirs)}`] : []),
  ];
  const agreed = dirs.length > 0 ? "autorisés" : "autorisées";
  return `Kibo : ${parts.join(" et ")} sont maintenant ${agreed}. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.`;
};
