import { type DeliveryRpcRequest, isDeliveryRequest, KiboError } from "@kibo/schema";
import { applyDeliveryImport, type DeliveryImportDeps, importDelivery } from "../projects/delivery-import";
import { type RpcExtension, type RpcHandler, requireLocal } from "../rpc-extensions";
import type { DeliveryOps } from "./delivery-ops";

type Method = DeliveryRpcRequest["method"];

function served<M extends Method>(
  methods: readonly M[],
  handle: (
    req: Extract<DeliveryRpcRequest, { method: M }>,
    ctx: Parameters<RpcExtension["handle"]>[1],
  ) => unknown,
): RpcExtension {
  const owns = (req: { method: string }): req is Extract<DeliveryRpcRequest, { method: M }> =>
    isDeliveryRequest(req) && methods.some((m) => m === req.method);
  return {
    methods,
    async handle(req, ctx) {
      if (!owns(req)) throw new KiboError("INTERNAL", `${req.method} is not a delivery method`);
      return handle(req, ctx);
    },
  };
}

export function deliveryRunsRpc(ops: DeliveryOps): RpcExtension {
  return served(["runs.denials", "runs.allowAndResume", "deliveryAgent"], (req, ctx) => {
    switch (req.method) {
      case "runs.denials":
        return ops.denials(req.runId);
      case "runs.allowAndResume": {
        requireLocal(ctx);
        const { method: _method, ...input } = req;
        return ops.allowAndResume(input);
      }
      case "deliveryAgent":
        return ops.deliveryAgent(req.projectId);
    }
  });
}

export function deliveryImportRpc(
  deps: () => DeliveryImportDeps,
  assertWritable: (projectId: string) => void,
) {
  return served(["projects.importDelivery", "projects.applyDeliveryImport"], (req, ctx) => {
    requireLocal(ctx);
    if (req.method === "projects.importDelivery") return importDelivery(deps(), req.registryPath);
    assertWritable(req.projectId);
    return applyDeliveryImport(deps(), {
      projectId: req.projectId,
      name: req.name,
      ...(req.registryPath === undefined ? {} : { registryPath: req.registryPath }),
    });
  });
}

export const localAllowFromComponents: RpcHandler = async (req, ctx) => {
  if (req.method === "componentCall" && req.call.kind === "run.allowAndResume") requireLocal(ctx);
  return { handled: false };
};
