import { z } from "zod";
import { AbsPath, DeliveryKind, DeliveryStepNumber } from "./delivery";
import { GithubPrRef } from "./external-ref";
import { GitBranchRef } from "./git-branch";
import { TicketKey } from "./ids";
import { ListProjectEventsInput, type ProjectEventPage } from "./project-event";
import type { TicketView } from "./rpc";
import type { Ticket } from "./ticket";
import { SessionState, SessionTool, type TicketSession } from "./ticket-session";

const DeclaredRef = z.discriminatedUnion("kind", [GitBranchRef, GithubPrRef]);

export const TRACKING_RPC = [
  z.object({
    method: z.literal("setTicketSession"),
    projectId: z.string().min(1),
    ticketKey: TicketKey.nullable(),
    cwd: AbsPath.nullable(),
    state: SessionState,
    tool: SessionTool.optional(),
  }),
  ListProjectEventsInput.extend({ method: z.literal("listProjectEvents") }),
  z.object({
    method: z.literal("declareTicketRef"),
    projectId: z.string().min(1),
    ticketKey: TicketKey,
    ref: DeclaredRef,
  }),
  z.object({
    method: z.literal("setDeliveryStep"),
    projectId: z.string().min(1),
    ticketKey: TicketKey,
    step: DeliveryStepNumber,
    note: z.string().max(300).optional(),
    kind: DeliveryKind.optional(),
  }),
] as const;

export type DeclareTicketRefInput = Omit<
  Extract<TrackingRpcRequest, { method: "declareTicketRef" }>,
  "method"
>;
export type DeclareTicketRefResult = { ticket: Ticket; statusChanged: boolean };

export type TrackingRpcRequest = z.infer<(typeof TRACKING_RPC)[number]>;
export const TRACKING_RPC_METHODS: readonly TrackingRpcRequest["method"][] = TRACKING_RPC.map(
  (schema) => schema.shape.method.value,
);

export type TrackingRpcResult = {
  setTicketSession: TicketSession | null;
  listProjectEvents: ProjectEventPage;
  declareTicketRef: DeclareTicketRefResult;
  setDeliveryStep: TicketView;
};
