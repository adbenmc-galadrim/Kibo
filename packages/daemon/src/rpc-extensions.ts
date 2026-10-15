import { KiboError, type RpcRequest } from "@kibo/schema";
import type { Service } from "./service";

export type RpcContext = { sessionHash: string; remote: boolean };
export const LOCAL_CONTEXT: RpcContext = { sessionHash: "local", remote: false };
export type RpcExtension = {
  methods: readonly RpcRequest["method"][];
  handle(req: RpcRequest, ctx: RpcContext): Promise<unknown>;
};

export type RpcOutcome = { handled: true; result: unknown } | { handled: false };
export type RpcHandler = (req: RpcRequest, ctx: RpcContext) => Promise<RpcOutcome>;

export async function dispatchRpc(
  service: Service,
  extensions: readonly RpcExtension[],
  req: RpcRequest,
  ctx: RpcContext,
  handlers: readonly RpcHandler[] = [],
): Promise<unknown> {
  const extension = extensions.find((e) => e.methods.includes(req.method));
  if (extension) return extension.handle(req, ctx);
  for (const handler of handlers) {
    const outcome = await handler(req, ctx);
    if (outcome.handled) return outcome.result;
  }
  return service.handle(req);
}

export function requireLocal(ctx: RpcContext): void {
  if (ctx.remote) throw new KiboError("FORBIDDEN", "this action is only allowed from this machine");
}
