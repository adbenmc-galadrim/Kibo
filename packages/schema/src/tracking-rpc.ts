import { z } from "zod";
import { type AppSettings, AppSettingsPatch } from "./app-settings";
import { AbsPath } from "./delivery";
import { TicketKey } from "./ids";
import { ListProjectEventsInput, type ProjectEventPage } from "./project-event";
import { SessionState, SessionTool, type TicketSession } from "./ticket-session";

export const TRACKING_RPC = [
  z.object({ method: z.literal("getAppSettings") }),
  z.object({ method: z.literal("setAppSettings"), patch: AppSettingsPatch }),
  z.object({
    method: z.literal("setTicketSession"),
    projectId: z.string().min(1),
    ticketKey: TicketKey.nullable(),
    cwd: AbsPath.nullable(),
    state: SessionState,
    tool: SessionTool.optional(),
  }),
  ListProjectEventsInput.extend({ method: z.literal("listProjectEvents") }),
] as const;

export type TrackingRpcRequest = z.infer<(typeof TRACKING_RPC)[number]>;
export const TRACKING_RPC_METHODS: readonly TrackingRpcRequest["method"][] = TRACKING_RPC.map(
  (schema) => schema.shape.method.value,
);

export type TrackingRpcResult = {
  getAppSettings: AppSettings;
  setAppSettings: AppSettings;
  setTicketSession: TicketSession | null;
  listProjectEvents: ProjectEventPage;
};
