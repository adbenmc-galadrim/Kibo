import { Database } from "bun:sqlite";
import { join } from "node:path";
import type { RpcRequest } from "@kibo/schema";
import { z } from "zod";

const Reply = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type Refusal = { status: number; code: string };
export type Client = {
  ok(req: RpcRequest): Promise<unknown>;
  refused(req: RpcRequest): Promise<Refusal>;
  post(req: RpcRequest, origin: string): Promise<Response>;
};

export async function pair({ url, token }: { url: string; token: string }): Promise<Client> {
  const res = await fetch(`${url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: url },
    body: JSON.stringify({ token }),
  });
  if (res.status !== 204) throw new Error(`pairing failed with ${res.status}`);
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  const post = (req: RpcRequest, origin: string) =>
    fetch(`${url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify(req),
    });
  const send = async (req: RpcRequest) => {
    const res = await post(req, url);
    return { status: res.status, reply: Reply.parse(await res.json()) };
  };
  return {
    post,
    async ok(req) {
      const { reply } = await send(req);
      if (!reply.ok) throw new Error(`${req.method} failed: ${reply.error.code} ${reply.error.message}`);
      return reply.result;
    },
    async refused(req) {
      const { status, reply } = await send(req);
      if (reply.ok) throw new Error(`${req.method} was accepted`);
      return { status, code: reply.error.code };
    },
  };
}

export type JournalRow = { kind: string; code: string; count: number };

export function readJournal(home: string, ref: string): JournalRow[] {
  const db = new Database(join(home, "kibo.db"), { readonly: true });
  try {
    return db
      .query<JournalRow, [string]>("SELECT kind, code, count FROM component_events WHERE ref = ? ORDER BY id")
      .all(ref);
  } finally {
    db.close();
  }
}

export function runtimeChildren(): number[] {
  const out = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,stat=,command="]).stdout.toString();
  return out
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([, ppid, stat, ...command]) => {
      const child = Number(ppid) === process.pid && !stat?.startsWith("Z");
      return child && command.join(" ").includes("component-runtime");
    })
    .map(([pid]) => Number(pid));
}

export async function eventually(
  check: () => boolean | Promise<boolean>,
  timeoutMs = 5_000,
): Promise<boolean> {
  for (const started = Date.now(); Date.now() - started < timeoutMs; await Bun.sleep(50)) {
    if (await check()) return true;
  }
  return check();
}
