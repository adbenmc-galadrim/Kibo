import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { KiboError } from "@kibo/schema";

export type Toolchain = { root: string };

export const isCompiled = (): boolean => Bun.main.startsWith("/$bunfs/");

const hasSdk = (root: string): boolean =>
  existsSync(join(root, "node_modules", "@kibo", "sdk", "package.json"));

function candidates(execPath: string, here: string): string[] {
  const execDir = dirname(existsSync(execPath) ? realpathSync(execPath) : execPath);
  return [
    join(execDir, "..", "Resources", "toolchain"),
    join(execDir, "..", "lib", "Kibo", "toolchain"),
    join(execDir, "toolchain"),
    resolve(here, "..", "..", ".."),
  ];
}

export function resolveToolchain(
  opts: {
    explicit?: string | null;
    env?: Record<string, string | undefined>;
    execPath?: string;
    here?: string;
  } = {},
): Toolchain {
  const env = opts.env ?? process.env;
  const explicit = opts.explicit ?? env.KIBO_TOOLCHAIN;
  if (explicit) {
    if (!hasSdk(explicit)) throw new KiboError("NOT_FOUND", `toolchain not found in ${explicit}`);
    return { root: explicit };
  }
  const found = candidates(opts.execPath ?? process.execPath, opts.here ?? import.meta.dir).find(hasSdk);
  if (!found) throw new KiboError("NOT_FOUND", "toolchain not found, set KIBO_TOOLCHAIN");
  return { root: found };
}

export const toolchainModules = (t: Toolchain): string => join(t.root, "node_modules");
