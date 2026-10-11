import { z } from "zod";
import type { Signal, SignalsView } from "./signal";

export const SIGNAL_RPC = [
  z.object({ method: z.literal("listSignals"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("ignoreSignal"), projectId: z.string().min(1), signalId: z.string().min(1) }),
] as const;

export type SignalRpcRequest = z.infer<(typeof SIGNAL_RPC)[number]>;
export type SignalRpcResult = { listSignals: SignalsView; ignoreSignal: Signal };

const SIGNAL_METHODS: ReadonlySet<string> = new Set(SIGNAL_RPC.map((schema) => schema.shape.method.value));

export const isSignalRequest = (req: { method: string }): req is SignalRpcRequest =>
  SIGNAL_METHODS.has(req.method);
