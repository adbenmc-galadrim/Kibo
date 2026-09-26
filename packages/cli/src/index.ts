import { join } from "node:path";
import { resolveToolchain, type Toolchain } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";
import { type Parsed, parseArgs } from "./args";
import { startDevServer } from "./commands/dev";
import { type ComponentKind, newCommand } from "./commands/new";
import { type PublishStrategy, publishCommand } from "./commands/publish";
import { componentDir, testCommand } from "./commands/test";
import { fr } from "./fr";

export type CliIo = { home: string; toolchain: Toolchain; out(line: string): void; err(line: string): void };

export function cliIo(): CliIo {
  return {
    home: process.env.KIBO_HOME ?? join(process.env.HOME ?? "", ".kibo"),
    toolchain: resolveToolchain(),
    out: (l) => console.log(l),
    err: (l) => console.error(l),
  };
}

const kindOf = (flags: Parsed["flags"]): ComponentKind =>
  flags.kind === "view" || flags.kind === "both" ? flags.kind : "widget";

const strategyOf = (flags: Parsed["flags"]): PublishStrategy | null =>
  flags["update-all"] === true ? "update-all" : flags["new-version"] === true ? "new-version" : null;

function portOf(flags: Parsed["flags"]): number {
  if (flags.port === undefined) return 0;
  const port = typeof flags.port === "string" && /^\d+$/.test(flags.port) ? Number(flags.port) : Number.NaN;
  if (!Number.isInteger(port) || port > 65_535)
    throw new KiboError("INVALID_INPUT", `invalid port: ${String(flags.port)}`);
  return port;
}

async function devCommand(target: string, flags: Parsed["flags"], io: CliIo): Promise<number> {
  const dev = await startDevServer(componentDir(target, io), io.toolchain, { port: portOf(flags) });
  io.out(fr.dev(dev.url));
  await new Promise<void>((resolve) => process.once("SIGINT", () => resolve()));
  dev.stop();
  return 0;
}

async function dispatch(command: string, target: string, flags: Parsed["flags"], io: CliIo): Promise<number> {
  switch (command) {
    case "new":
      return newCommand(target, kindOf(flags), flags.server === true, io);
    case "test":
      return testCommand(target, io);
    case "dev":
      return devCommand(target, flags, io);
    case "publish":
      return publishCommand(target, strategyOf(flags), io);
    default:
      io.err(fr.usage);
      return 2;
  }
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const { positional, flags } = parseArgs(argv);
  const [scope, command, target] = positional;
  if (scope !== "component" || !command || !target) {
    io.err(fr.usage);
    return 2;
  }
  try {
    return await dispatch(command, target, flags, io);
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    io.err(fr.error(e.code, e.detail));
    return 1;
  }
}
