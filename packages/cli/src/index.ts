import { join, resolve } from "node:path";
import { KiboError } from "@kibo/schema";
import { type Parsed, parseArgs } from "./args";
import { featuresCommand } from "./commands/features";
import { planCommand } from "./commands/plan";
import { projectsCommand } from "./commands/projects";
import { questionsCommand } from "./commands/questions";
import { rpcCommand } from "./commands/rpc";
import { sprintsCommand } from "./commands/sprints";
import { runTicketsCommand } from "./commands/tickets";
import { DaemonError, isUnknownMethod } from "./daemon-client";
import { explainError } from "./error-text";
import { fr, frRpc, frTickets } from "./fr";
import { frPlan } from "./fr-plan";
import { frQuestions } from "./fr-questions";
import { frSprints } from "./fr-sprints";
import { frFeatures } from "./fr-write";

export type CliIo = { home: string; out(line: string): void; err(line: string): void };

export function cliIo(): CliIo {
  return {
    home: process.env.KIBO_HOME ?? join(process.env.HOME ?? "", ".kibo"),
    out: (l) => console.log(l),
    err: (l) => console.error(l),
  };
}

function errorText(e: KiboError, command: string): string {
  const explained = explainError(e);
  if (explained !== null) return explained;
  if (!(e instanceof DaemonError) || e.daemon === null) return fr.error(e.code, e.detail);
  const { home, version } = e.daemon;
  if (isUnknownMethod(e)) return fr.daemonTooOld(fr.daemonName(home, version), command);
  return fr.daemonError(e.code, e.detail, home, version);
}

async function reportingErrors(io: CliIo, run: () => Promise<number>, command = ""): Promise<number> {
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    io.err(errorText(e, command));
    return 1;
  }
}

const withHome = (io: CliIo, flags: Parsed["flags"]): CliIo =>
  typeof flags.home === "string" ? { ...io, home: resolve(flags.home) } : io;

const SCOPE_USAGE = new Map<string | undefined, string>([
  ["tickets", frTickets.usage],
  ["features", frFeatures.usage],
  ["sprints", frSprints.usage],
  ["questions", frQuestions.usage],
  ["plan", frPlan.usage],
  ["rpc", frRpc.usage],
]);

function help(scope: string | undefined, io: CliIo): number {
  io.out(SCOPE_USAGE.get(scope) ?? fr.usage);
  return 0;
}

type ScopeCommand = (positional: string[], flags: Parsed["flags"], io: CliIo) => Promise<number>;

const SCOPES = new Map<string | undefined, ScopeCommand>([
  ["tickets", (positional, flags, io) => runTicketsCommand(positional.slice(1), flags, io)],
  ["features", (positional, flags, io) => featuresCommand(positional.slice(1), flags, io)],
  ["sprints", (positional, flags, io) => sprintsCommand(positional.slice(1), flags, io)],
  ["questions", (positional, flags, io) => questionsCommand(positional.slice(1), flags, io)],
  ["plan", (positional, flags, io) => planCommand(positional.slice(1), flags, io)],
  ["projects", (positional, flags, io) => projectsCommand(positional.slice(1), flags, io)],
  ["rpc", (positional, flags, io) => rpcCommand(positional, flags, io)],
]);

export async function runCli(argv: string[], given: CliIo): Promise<number> {
  const { positional, flags } = parseArgs(argv);
  const io = withHome(given, flags);
  const [scope, command] = positional;
  const label = [scope, command].filter((part) => part !== undefined).join(" ");
  if (flags.help === true) return help(scope, io);
  const scoped = SCOPES.get(scope);
  if (scoped !== undefined) return reportingErrors(io, () => scoped(positional, flags, io), label);
  io.err(fr.usage);
  return 2;
}
