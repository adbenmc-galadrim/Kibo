import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isKiboErrorCode, KiboError, RpcRequest, type RpcResult } from "@kibo/schema";
import { z } from "zod";

export type SeedClient = {
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  close(): Promise<void>;
};
export type DaemonAccess = { port: number; token: string };

const DaemonInfo = z.object({ port: z.number().int().min(1).max(65_535) });
const RpcReply = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);

export function readDaemonAccess(home: string): DaemonAccess {
  const info = join(home, "daemon.json");
  const token = join(home, "token");
  if (!existsSync(info) || !existsSync(token)) throw new KiboError("NOT_FOUND", "daemon not running");
  const { port } = DaemonInfo.parse(JSON.parse(readFileSync(info, "utf8")));
  return { port, token: readFileSync(token, "utf8").trim() };
}

async function pair(base: string, token: string, f: typeof fetch): Promise<string> {
  const res = await f(`${base}/api/pair`, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (res.status !== 204) throw new KiboError("UNAUTHORIZED", "pairing refused");
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  if (cookie === "") throw new KiboError("UNAUTHORIZED", "pairing returned no session");
  return cookie;
}

export async function connectLocalDaemon(
  access: DaemonAccess & { fetch?: typeof fetch },
): Promise<SeedClient> {
  const f = access.fetch ?? fetch;
  const base = `http://127.0.0.1:${access.port}`;
  const cookie = await pair(base, access.token, f);
  const send = async (req: RpcRequest): Promise<unknown> => {
    const res = await f(`${base}/api/rpc`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json", cookie },
      body: JSON.stringify(RpcRequest.parse(req)),
    });
    const reply = RpcReply.parse(await res.json());
    if (reply.ok) return reply.result;
    const code = reply.error.code;
    throw new KiboError(isKiboErrorCode(code) ? code : "INTERNAL", reply.error.message);
  };
  const rpc = <R extends RpcRequest>(req: R) => send(req) as Promise<RpcResult[R["method"]]>;
  return {
    rpc,
    async close() {
      const sessions = await rpc({ method: "listSessions" });
      const own = sessions.find((s) => s.current);
      if (own) await rpc({ method: "revokeSession", id: own.id });
    },
  };
}
