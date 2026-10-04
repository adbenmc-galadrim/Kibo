import type { DesignFrameKey, DesignProvider, FrameMime, KiboErrorCode } from "@kibo/schema";

export type FrameMeta = { name: string; width: number | null; height: number | null };
export type FrameRender = { meta: FrameMeta; body: Uint8Array; mime: FrameMime; version: string | null };
export type DesignProviderClient = {
  id: DesignProvider;
  connected(): Promise<boolean>;
  version(key: DesignFrameKey): Promise<string | null>;
  metadata(key: DesignFrameKey): Promise<FrameMeta>;
  render(key: DesignFrameKey): Promise<FrameRender>;
};

export const UNREACHABLE_CODES: ReadonlySet<KiboErrorCode> = new Set<KiboErrorCode>([
  "REMOTE_UNAVAILABLE",
  "TIMEOUT",
  "RATE_LIMITED",
  "MCP_UNAVAILABLE",
]);
