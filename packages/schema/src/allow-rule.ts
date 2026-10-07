import { z } from "zod";

export const ALLOW_MAX = 50;
const SHAPE = /^([A-Z][A-Za-z]{1,39})(?:\(([^\n()]{1,200})\))?$/;
const EVERYTHING = new Set(["*", "**"]);
const SHELLS = ["sh", "bash", "zsh", "dash", "fish", "ksh", "csh", "tcsh", "ash"];
const WRAPPERS = [
  "env",
  "exec",
  "eval",
  "xargs",
  "sudo",
  "doas",
  "nohup",
  "command",
  "builtin",
  "nice",
  "timeout",
  "time",
  "source",
  ".",
];
const RUNS_ANYTHING = [...SHELLS, ...WRAPPERS];
const PLAIN_WORD = /^[A-Za-z0-9._/@+-]+\*?$/;

function commandName(word: string): string | null {
  const bare = word.endsWith(":*") ? word.slice(0, -2) : word;
  if (!PLAIN_WORD.test(bare)) return null;
  const name = bare.slice(bare.lastIndexOf("/") + 1).toLowerCase();
  return name.length > 0 ? name : null;
}

function mayRunAnything(name: string): boolean {
  if (!name.endsWith("*")) return RUNS_ANYTHING.includes(name);
  const prefix = name.slice(0, -1);
  return RUNS_ANYTHING.some((candidate) => candidate.startsWith(prefix));
}

function isSafeBashPattern(pattern: string): boolean {
  const [first = ""] = pattern.split(/\s+/);
  const name = commandName(first);
  return name !== null && !mayRunAnything(name);
}

export function isSafeAllowRule(rule: string): boolean {
  const match = SHAPE.exec(rule);
  if (!match) return false;
  if (/dangerously/i.test(rule)) return false;
  const [, tool, pattern] = match;
  if (pattern === undefined) return tool !== "Bash";
  const trimmed = pattern.trim();
  if (trimmed.length === 0 || EVERYTHING.has(trimmed)) return false;
  return tool !== "Bash" || isSafeBashPattern(trimmed);
}

export const AllowRule = z.string().refine(isSafeAllowRule, "unsafe or malformed permission rule");
export const AllowRules = z.array(AllowRule).max(ALLOW_MAX);
export type AllowRules = z.infer<typeof AllowRules>;
