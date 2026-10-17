import { isDeliveryRequest, KiboError } from "@kibo/schema";
import { assertNotInboxForAgents } from "../inbox/inbox-rules";
import type { RpcExtension } from "../rpc-extensions";
import { type DeliverDeps, deliver } from "./deliver";

export type DeliverRpcData = { assertWritable(projectId: string): void };

export function deliverRpc(deps: DeliverDeps, data: DeliverRpcData): RpcExtension {
  return {
    methods: ["deliver"],
    async handle(req) {
      if (!isDeliveryRequest(req) || req.method !== "deliver")
        throw new KiboError("INTERNAL", `${req.method} is not a delivery method`);
      assertNotInboxForAgents(req.projectId);
      data.assertWritable(req.projectId);
      return deliver(deps, { projectId: req.projectId, ticketId: req.ticketId, mode: req.mode });
    },
  };
}
