import { join, resolve } from "node:path";
import { resolveToolchain, type Toolchain } from "@kibo/devkit";
import { KiboError, Template } from "@kibo/schema";
import { type Parsed, parseArgs } from "./args";
import { startDevServer } from "./commands/dev";
import { type MarketCliDeps, runMarketCommand } from "./commands/market";
import { type ComponentKind, newCommand } from "./commands/new";
import { projectsCommand } from "./commands/projects";
import {
  connectOrExplain,
  marketPublishCommand,
  type PublishStrategy,
  publishCommand,
} from "./commands/publish";
import { sprintsCommand } from "./commands/sprints";
import { componentDir, testCommand } from "./commands/test";
import { runTicketsCommand } from "./commands/tickets";
import { fr, frTickets } from "./fr";

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

function templateOf(flag: string | true | undefined): Template {
  if (flag === undefined) return "blank";
  const parsed = Template.safeParse(flag);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `unknown template ${String(flag)}`);
  return parsed.data;
}

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
      return newCommand(target, kindOf(flags), flags.server === true, templateOf(flags.template), io);
    case "test":
      return testCommand(target, io);
    case "dev":
      return devCommand(target, flags, io);
    case "publish":
      return typeof flags.to === "string"
        ? marketPublishCommand(
            target,
            flags.to,
            typeof flags.publisher === "string" ? flags.publisher : null,
            io,
          )
        : publishCommand(target, strategyOf(flags), io);
    default:
      io.err(fr.usage);
      return 2;
  }
}

function marketDeps(io: CliIo): MarketCliDeps {
  return {
    daemon: async () => {
      const client = await connectOrExplain(io);
      return client && { exportKpkg: (input) => client.rpc({ method: "exportKpkg", ...input }) };
    },
    out: io.out,
    err: io.err,
    now: () => new Date(),
  };
}

async function reportingErrors(io: CliIo, run: () => Promise<number>): Promise<number> {
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    io.err(fr.error(e.code, e.detail));
    return 1;
  }
}

const withHome = (io: CliIo, flags: Parsed["flags"]): CliIo =>
  typeof flags.home === "string" ? { ...io, home: resolve(flags.home) } : io;

function help(scope: string | undefined, io: CliIo): number {
  io.out(scope === "tickets" ? frTickets.usage : fr.usage);
  return 0;
}

export async function runCli(argv: string[], given: CliIo): Promise<number> {
  const { positional, flags } = parseArgs(argv);
  const io = withHome(given, flags);
  const [scope, command, target] = positional;
  if (flags.help === true) return help(scope, io);
  if (scope === "market")
    return reportingErrors(io, () => runMarketCommand(positional.slice(1), flags, marketDeps(io)));
  if (scope === "tickets")
    return reportingErrors(io, () => runTicketsCommand(positional.slice(1), flags, io));
  if (scope === "sprints") return reportingErrors(io, () => sprintsCommand(positional.slice(1), flags, io));
  if (scope === "projects") return reportingErrors(io, () => projectsCommand(positional.slice(1), flags, io));
  if (scope !== "component" || !command || !target) {
    io.err(fr.usage);
    return 2;
  }
  return reportingErrors(io, () => dispatch(command, target, flags, io));
}
