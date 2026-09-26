import { INTEGRATION_RPC, type IntegrationRpcRequest, type RpcRequest } from "@kibo/schema";

export const INTEGRATION_METHODS: ReadonlySet<string> = new Set(
  INTEGRATION_RPC.map((s) => s.shape.method.value),
);

export const isIntegrationRequest = (req: RpcRequest): req is IntegrationRpcRequest =>
  INTEGRATION_METHODS.has(req.method);
