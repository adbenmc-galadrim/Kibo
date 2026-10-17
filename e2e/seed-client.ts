import { RpcRequest } from "../packages/schema/src/index";
import type { SeedRpc } from "./seed-emis-maquettes";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

export async function waitForDaemon(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const up = await fetch(`${base}/`).then(
      (res) => res.status < 500,
      () => false,
    );
    if (up) return;
    await Bun.sleep(100);
  }
  throw new Error(`daemon at ${base} did not answer within ${timeoutMs} ms`);
}

export async function connectSeedRpc(base: string, token: string): Promise<SeedRpc> {
  const paired = await fetch(`${base}/api/pair`, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const cookie = (paired.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  if (paired.status !== 204 || cookie === "") throw new Error(`pairing refused (${paired.status})`);
  return async (req) => {
    const res = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json", cookie },
      body: JSON.stringify(RpcRequest.parse(req)),
    });
    const reply: unknown = await res.json();
    if (field(reply, "ok") === true) return field(reply, "result");
    throw new Error(`rpc ${req.method}: ${JSON.stringify(field(reply, "error"))}`);
  };
}
