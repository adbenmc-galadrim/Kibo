import type { Parsed } from "../args";
import { type DaemonClient, DaemonError } from "../daemon-client";
import { fr, frRpc } from "../fr";
import { readTextArg } from "../text-source";
import { type Connect, printJson, type SessionIo, withClient } from "./daemon-session";

type Body = { body: Record<string, unknown> } | { problem: string | null };

function parseJson(text: string): { value: unknown } | { problem: string } {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    return { problem: frRpc.unreadable(e instanceof Error ? e.message : String(e)) };
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyOf(text: string): Body {
  const parsed = parseJson(text);
  if ("problem" in parsed) return parsed;
  const value = parsed.value;
  if (!isRecord(value) || typeof value.method !== "string") return { problem: frRpc.noMethod };
  return { body: value };
}

async function send(client: DaemonClient, body: Record<string, unknown>, io: SessionIo): Promise<number> {
  try {
    printJson(io, await client.raw(body));
    return 0;
  } catch (e) {
    if (!(e instanceof DaemonError)) throw e;
    io.err(fr.error(e.code, e.detail));
    return 1;
  }
}

export async function rpcCommand(
  positional: readonly string[],
  _flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
  cwd: string = process.cwd(),
  stdin?: () => string,
): Promise<number> {
  const raw = positional[1];
  const given: Body = raw === undefined ? { problem: null } : bodyOf(readTextArg(raw, cwd, stdin));
  if ("problem" in given) {
    if (given.problem !== null) io.err(given.problem);
    io.err(frRpc.usage);
    return 2;
  }
  return withClient(io, (client) => send(client, given.body, io), connect);
}
