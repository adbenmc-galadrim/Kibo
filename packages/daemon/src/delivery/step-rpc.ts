import { readProject } from "@kibo/core";
import {
  type DeliveryRpcRequest,
  isDeliveryRequest,
  KiboError,
  type RunView,
  type TicketView,
} from "@kibo/schema";
import { activeRunOf } from "../agents/assign-preview";
import { type Docs, KIBO_COMMAND } from "../docs";
import type { RpcExtension } from "../rpc-extensions";

export type StepDocs = Pick<Docs, "project" | "activity" | "run" | "assertWritable" | "today">;
export type StepRpcDeps = { docs: StepDocs; runs(): readonly RunView[]; now(): number };
export type SetDeliveryStepInput = Extract<DeliveryRpcRequest, { method: "setDeliveryStep" }>;

function ticketByKey(docs: StepDocs, projectId: string, key: string): TicketView | null {
  const { tickets } = readProject(docs.project(projectId), docs.today(), docs.activity(projectId));
  return tickets.find((t) => t.key === key) ?? null;
}

export function setDeliveryStep(deps: StepRpcDeps, req: SetDeliveryStepInput): TicketView {
  const { docs } = deps;
  const ticket = ticketByKey(docs, req.projectId, req.ticketKey);
  if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${req.ticketKey} not found`);
  docs.assertWritable(req.projectId);
  const ownRuns = deps.runs().filter((r) => r.projectId === req.projectId);
  const runId = activeRunOf(ownRuns, ticket.id)?.id ?? null;
  const delivery = { step: req.step, note: req.note ?? "", at: deps.now(), runId };
  docs.run(req.projectId, { method: "setTicketDelivery", ticketId: ticket.id, delivery }, KIBO_COMMAND);
  const updated = ticketByKey(docs, req.projectId, req.ticketKey);
  if (!updated) throw new KiboError("NOT_FOUND", `ticket ${req.ticketKey} not found`);
  return updated;
}

export function deliveryStepRpc(deps: StepRpcDeps): RpcExtension {
  return {
    methods: ["setDeliveryStep"],
    async handle(req) {
      if (!isDeliveryRequest(req) || req.method !== "setDeliveryStep")
        throw new KiboError("INTERNAL", `${req.method} is not a delivery step method`);
      return setDeliveryStep(deps, req);
    },
  };
}
