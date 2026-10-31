import { z } from "zod";
import { TicketKey } from "./ids";
import { T3Thread } from "./t3-thread";

export const T3Status = z.object({
  available: z.boolean(),
  reason: z.enum(["missing", "server-down"]).optional(),
  bin: z.string(),
});
export type T3Status = z.infer<typeof T3Status>;

export const T3Preview = z.object({
  argv: z.array(z.string()),
  command: z.string(),
  folder: z.string(),
  warning: z.string().nullable(),
});
export type T3Preview = z.infer<typeof T3Preview>;

export const T3Launch = z.object({ thread: T3Thread, command: z.string() });
export type T3Launch = z.infer<typeof T3Launch>;

const onTicket = { projectId: z.string().min(1), ticketKey: TicketKey };

export const T3_RPC = [
  z.object({ method: z.literal("t3.status") }),
  z.object({ method: z.literal("t3.preview"), ...onTicket }),
  z.object({ method: z.literal("t3.launch"), ...onTicket }),
  z.object({ method: z.literal("t3.threadOf"), ...onTicket }),
  z.object({ method: z.literal("t3.refresh"), projectId: z.string().min(1) }),
] as const;

export type T3RpcRequest = z.infer<(typeof T3_RPC)[number]>;
export const T3_RPC_METHODS: readonly T3RpcRequest["method"][] = T3_RPC.map(
  (schema) => schema.shape.method.value,
);

export type T3RpcResult = {
  "t3.status": T3Status;
  "t3.preview": T3Preview;
  "t3.launch": T3Launch;
  "t3.threadOf": T3Thread | null;
  "t3.refresh": T3Thread[];
};
