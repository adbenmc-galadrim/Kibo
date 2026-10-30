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
