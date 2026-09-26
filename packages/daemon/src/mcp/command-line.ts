import type { McpServerInput } from "@kibo/schema";

const SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function shellQuote(arg: string): string {
  if (arg === "") return "''";
  return SAFE.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

export function commandLineOf(s: McpServerInput): string {
  return s.transport === "stdio" ? [s.command, ...s.args].map(shellQuote).join(" ") : s.url;
}
