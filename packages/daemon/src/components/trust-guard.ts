import type { RpcRequest } from "@kibo/schema";
import { type RpcHandler, requireLocal } from "../rpc-extensions";

const GRANTING: ReadonlySet<RpcRequest["method"]> = new Set([
  "approveComponent",
  "publishComponent",
  "finalizeComponentDraft",
]);

export const componentTrustGuard: RpcHandler = async (req, ctx) => {
  if (GRANTING.has(req.method)) requireLocal(ctx);
  return { handled: false };
};
