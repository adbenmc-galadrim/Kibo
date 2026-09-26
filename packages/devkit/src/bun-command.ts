import { KiboError } from "@kibo/schema";
import { isCompiled } from "./toolchain";

export type BunCommand = { argv: string[]; env: Record<string, string> };

export const BUN_BE_BUN_SUPPORTED = true;

export function bunCommand(
  opts: { compiled?: boolean; execPath?: string; which?: (bin: string) => string | null } = {},
): BunCommand {
  const compiled = opts.compiled ?? isCompiled();
  const execPath = opts.execPath ?? process.execPath;
  if (!compiled) return { argv: [execPath], env: {} };
  if (BUN_BE_BUN_SUPPORTED) return { argv: [execPath], env: { BUN_BE_BUN: "1" } };
  const found = (opts.which ?? Bun.which)("bun");
  if (!found) throw new KiboError("NOT_FOUND", "bun is not installed or not in PATH");
  return { argv: [found], env: {} };
}
