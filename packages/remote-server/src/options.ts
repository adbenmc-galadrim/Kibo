import { KiboError } from "@kibo/schema";
import type { RemoteServerOptions } from "./server";

type CliOptions = Pick<RemoteServerOptions, "port" | "db" | "origin" | "rpId" | "setupCode" | "staticDir">;

const DEFAULT_PORT = 8080;
const DEFAULT_DB = "/data/kibo-remote.db";
const MAX_PORT = 65_535;

const FLAGS = {
  "--port": "KIBO_REMOTE_PORT",
  "--db": "KIBO_REMOTE_DB",
  "--origin": "KIBO_REMOTE_ORIGIN",
  "--static": "KIBO_REMOTE_STATIC",
  "--setup-code": "KIBO_REMOTE_SETUP_CODE",
} as const;
type Flag = keyof typeof FLAGS;

const isFlag = (text: string): text is Flag => Object.hasOwn(FLAGS, text);

function readFlags(argv: string[]): Map<Flag, string> {
  const flags = new Map<Flag, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];
    if (!isFlag(flag) || value === undefined)
      throw new KiboError("INVALID_INPUT", `unexpected argument ${flag}`);
    flags.set(flag, value);
  }
  return flags;
}

function parsePort(text: string | undefined): number {
  if (text === undefined) return DEFAULT_PORT;
  const port = Number(text);
  if (!/^\d+$/.test(text) || port > MAX_PORT) throw new KiboError("INVALID_INPUT", `invalid port ${text}`);
  return port;
}

function parseOrigin(text: string | undefined): URL {
  if (!text) throw new KiboError("INVALID_INPUT", "--origin or KIBO_REMOTE_ORIGIN is required");
  try {
    return new URL(text);
  } catch {
    throw new KiboError("INVALID_INPUT", `invalid origin ${text}`);
  }
}

export function parseOptions(argv: string[], env: Record<string, string | undefined>): CliOptions {
  const flags = readFlags(argv);
  const value = (flag: Flag) => flags.get(flag) ?? env[FLAGS[flag]];
  const origin = parseOrigin(value("--origin"));
  const setupCode = value("--setup-code");
  if (!setupCode) throw new KiboError("INVALID_INPUT", "--setup-code or KIBO_REMOTE_SETUP_CODE is required");
  return {
    port: parsePort(value("--port")),
    db: value("--db") || DEFAULT_DB,
    origin: origin.origin,
    rpId: origin.hostname,
    setupCode,
    staticDir: value("--static") || null,
  };
}
