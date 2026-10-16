import { z } from "zod";
import { type AppSettings, AppSettingsPatch } from "./app-settings";

export const TRACKING_RPC = [
  z.object({ method: z.literal("getAppSettings") }),
  z.object({ method: z.literal("setAppSettings"), patch: AppSettingsPatch }),
] as const;

export type TrackingRpcRequest = z.infer<(typeof TRACKING_RPC)[number]>;
export const TRACKING_RPC_METHODS: readonly TrackingRpcRequest["method"][] = TRACKING_RPC.map(
  (schema) => schema.shape.method.value,
);

export type TrackingRpcResult = { getAppSettings: AppSettings; setAppSettings: AppSettings };
