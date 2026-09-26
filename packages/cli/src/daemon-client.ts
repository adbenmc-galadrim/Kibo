import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isKiboErrorCode, KiboError, type RpcRequest, type RpcResult } from "@kibo/schema";
import { z } from "zod";

export type DaemonClient = {
  rpc<M extends RpcRequest["method"]>(req: Extract<RpcRequest, { method: M }>): Promise<RpcResult[M]>;
};

const Port = z.number().int().min(0).max(65_535);
const DaemonInfo = z.object({ port: Port, sandboxPort: Port, pid: z.number().int().positive() });

export const daemonInfoFile = (home: string): string => join(home, "daemon.json");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new KiboError(
      "STORE_CORRUPT",
      `unreadable daemon.json: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function readDaemonPort(home: string): number | null {
  const file = daemonInfoFile(home);
  if (!existsSync(file)) return null;
  const parsed = DaemonInfo.safeParse(parseJson(readFileSync(file, "utf8")));
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `malformed daemon.json: ${parsed.error.message}`);
  return parsed.data.port;
}

function errorOf(body: object): KiboError {
  const error: unknown = Reflect.get(body, "error");
  const code = typeof error === "object" && error !== null ? Reflect.get(error, "code") : null;
  const message = typeof error === "object" && error !== null ? String(Reflect.get(error, "message")) : "";
  return new KiboError(isKiboErrorCode(code) ? code : "INTERNAL", message);
}

async function pair(base: string, token: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${base}/api/pair`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    throw new KiboError("NOT_FOUND", `daemon not reachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status !== 204) throw new KiboError("UNAUTHORIZED", "pairing refused");
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

export async function connectDaemon(home: string): Promise<DaemonClient> {
  const port = readDaemonPort(home);
  const tokenFile = join(home, "token");
  if (port === null || !existsSync(tokenFile)) throw new KiboError("NOT_FOUND", "daemon not running");
  const base = `http://127.0.0.1:${port}`;
  const cookie = await pair(base, readFileSync(tokenFile, "utf8").trim());
  return {
    async rpc(req) {
      const res = await fetch(`${base}/api/rpc`, {
        method: "POST",
        headers: { origin: base, "content-type": "application/json", cookie },
        body: JSON.stringify(req),
      });
      const body: unknown = await res.json();
      if (typeof body !== "object" || body === null)
        throw new KiboError("INTERNAL", "invalid daemon response");
      if (Reflect.get(body, "ok") !== true) throw errorOf(body);
      return Reflect.get(body, "result") as never;
    },
  };
}
