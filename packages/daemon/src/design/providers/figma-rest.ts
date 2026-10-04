import { type DesignFrameKey, KiboError, MAX_DESIGN_FRAME_BYTES, sniffImage } from "@kibo/schema";
import { z } from "zod";
import { FIGMA_API, FIGMA_AUTH, FIGMA_RULES } from "../../integrations/net";
import type { Redactor } from "../../integrations/redact";
import type { IntegrationFetch, IntegrationResponse } from "../../integrations/types";
import { parseRemote, remoteError } from "./http";
import { createRatePause, retryAfterSeconds } from "./pause";
import type { DesignProviderClient, FrameMeta, FrameRender } from "./types";

type FigmaKey = Extract<DesignFrameKey, { provider: "figma" }>;
export type FigmaRest = DesignProviderClient & {
  me(token: string): Promise<{ handle: string; email: string | null }>;
};

const Me = z.object({ handle: z.string().min(1), email: z.string().nullable().optional() });
const Box = z.object({ width: z.number(), height: z.number() });
const Nodes = z.object({
  version: z.string(),
  nodes: z.record(
    z.string(),
    z
      .object({ document: z.object({ name: z.string(), absoluteBoundingBox: Box.nullable().optional() }) })
      .nullable(),
  ),
});
const Images = z.object({ images: z.record(z.string(), z.string().url().nullable()) });

const figmaKey = (key: DesignFrameKey): FigmaKey => {
  if (key.provider !== "figma") throw new KiboError("INVALID_INPUT", "not a figma frame");
  return key;
};

export function createFigmaRest(deps: {
  fetch: IntegrationFetch;
  token(): Promise<string | null>;
  redactor: Redactor;
  now(): number;
}): FigmaRest {
  const pause = createRatePause(deps.now);
  const redact = (t: string) => deps.redactor.redact(t);
  const get = async (path: string, token: string): Promise<IntegrationResponse> => {
    if (pause.active()) throw new KiboError("RATE_LIMITED", "figma rate limit (paused)");
    deps.redactor.add(token);
    const res = await deps.fetch(
      `https://${FIGMA_API}${path}`,
      { bearer: token, auth: FIGMA_AUTH },
      FIGMA_RULES,
    );
    if (res.status === 429) pause.set(retryAfterSeconds(res.headers));
    return res;
  };
  const authed = async () => {
    const token = await deps.token();
    if (!token) throw new KiboError("NOT_CONNECTED", "figma token is not configured");
    return token;
  };
  const nodes = async (key: FigmaKey): Promise<{ version: string; meta: FrameMeta }> => {
    const ids = encodeURIComponent(key.nodeId);
    const res = await get(`/v1/files/${key.fileKey}/nodes?ids=${ids}&depth=1`, await authed());
    const file = parseRemote("figma", res, Nodes, redact);
    const node = file.nodes[key.nodeId];
    if (!node) throw new KiboError("REMOTE_NOT_FOUND", `figma node ${key.nodeId} not found`);
    const box = node.document.absoluteBoundingBox ?? null;
    return {
      version: file.version,
      meta: { name: node.document.name, width: box?.width ?? null, height: box?.height ?? null },
    };
  };
  const download = async (url: string): Promise<Uint8Array> => {
    const image = await deps.fetch(url, { maxBytes: MAX_DESIGN_FRAME_BYTES }, FIGMA_RULES);
    if (image.status !== 200) throw remoteError("figma", image.status, "", redact);
    if (image.truncated) throw new KiboError("TOO_LARGE", "frame image exceeds the limit");
    if (sniffImage(image.body) !== "image/png")
      throw new KiboError("REMOTE_REJECTED", "figma image is not a png");
    return image.body;
  };
  return {
    id: "figma",
    connected: async () => (await deps.token()) !== null,
    version: async (key) => (await nodes(figmaKey(key))).version,
    metadata: async (key) => (await nodes(figmaKey(key))).meta,
    async render(key): Promise<FrameRender> {
      const k = figmaKey(key);
      const { version, meta } = await nodes(k);
      const ids = encodeURIComponent(k.nodeId);
      const res = await get(`/v1/images/${k.fileKey}?ids=${ids}&format=png&scale=2`, await authed());
      const url = parseRemote("figma", res, Images, redact).images[k.nodeId] ?? null;
      if (!url) throw new KiboError("REMOTE_REJECTED", "figma could not render this frame");
      return { meta, body: await download(url), mime: "image/png", version };
    },
    async me(token) {
      const me = parseRemote("figma", await get("/v1/me", token), Me, redact);
      return { handle: me.handle, email: me.email ?? null };
    },
  };
}
