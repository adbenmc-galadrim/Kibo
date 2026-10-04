import { type DesignFrame, designFrameId, KiboError, parseDesignUrl } from "@kibo/schema";
import { PIXEL_PNG } from "./mock-assets";

export type MockFrame = {
  url: string;
  name: string;
  width?: number;
  height?: number;
  png?: string;
  stale?: boolean;
  reachable?: boolean;
};

const idOf = (url: string): string | null => {
  const parsed = parseDesignUrl(url);
  return parsed ? designFrameId(parsed.key) : null;
};

export function mockDesignFrame(
  frames: readonly MockFrame[],
  url: string,
  _refresh: boolean,
  now = Date.now(),
): DesignFrame {
  const parsed = parseDesignUrl(url);
  if (!parsed) throw new KiboError("INVALID_INPUT", "not a figma or penpot frame url");
  const id = designFrameId(parsed.key);
  const frame = frames.find((f) => idOf(f.url) === id);
  if (!frame) throw new KiboError("NOT_CONNECTED", `${parsed.key.provider} is not connected`);
  return {
    id,
    provider: parsed.key.provider,
    name: frame.name,
    width: frame.width ?? null,
    height: frame.height ?? null,
    url: `data:image/png;base64,${frame.png ?? PIXEL_PNG}`,
    mime: "image/png",
    fetchedAt: now,
    stale: frame.stale ?? false,
    reachable: frame.reachable ?? true,
    source: parsed.url,
  };
}
