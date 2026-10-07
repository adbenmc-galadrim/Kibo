import { z } from "zod";

export const ALLOW_MAX = 50;
const SHAPE = /^([A-Z][A-Za-z]{1,39})(?:\(([^\n()]{1,200})\))?$/;

export function isSafeAllowRule(rule: string): boolean {
  const match = SHAPE.exec(rule);
  if (!match) return false;
  if (/dangerously/i.test(rule)) return false;
  const [, tool, pattern] = match;
  if (tool === "Bash") {
    const trimmed = (pattern ?? "").trim();
    return trimmed.length > 0 && trimmed !== "*";
  }
  return pattern === undefined || pattern.trim().length > 0;
}

export const AllowRule = z.string().refine(isSafeAllowRule, "unsafe or malformed permission rule");
export const AllowRules = z.array(AllowRule).max(ALLOW_MAX);
export type AllowRules = z.infer<typeof AllowRules>;
