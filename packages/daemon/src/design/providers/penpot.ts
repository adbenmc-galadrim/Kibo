import { type DesignFrameKey, FrameMime, KiboError, MAX_DESIGN_FRAME_BYTES, sniffImage } from "@kibo/schema";
import { z } from "zod";
import { PENPOT_AUTH, penpotRules } from "../../integrations/net";
import type { Redactor } from "../../integrations/redact";
import type { IntegrationFetch } from "../../integrations/types";
import { parseRemote, remoteError } from "./http";
import { createRatePause, retryAfterSeconds } from "./pause";
import type { DesignProviderClient, FrameMeta, FrameRender } from "./types";

type PenpotKey = Extract<DesignFrameKey, { provider: "penpot" }>;
type Target = { key: PenpotKey; instance: string; token: string };
export type PenpotClient = DesignProviderClient & {
  profile(instance: string, token: string): Promise<{ fullname: string; email: string | null }>;
};

const Profile = z.object({ fullname: z.string(), email: z.string().nullable().optional() });
const Page = z.object({
  objects: z.record(
    z.string(),
    z.object({ name: z.string(), width: z.number().optional(), height: z.number().optional() }),
  ),
});
const Thumbnails = z.record(z.string(), z.string());

export function createPenpot(deps: {
  fetch: IntegrationFetch;
  instance(): string | null;
  token(): Promise<string | null>;
  redactor: Redactor;
  now(): number;
}): PenpotClient {
  const pause = createRatePause(deps.now);
  const redact = (t: string) => deps.redactor.redact(t);
  const rpc = async <T>(
    command: string,
    body: object,
    instance: string,
    token: string,
    schema: z.ZodType<T>,
  ) => {
    if (pause.active()) throw new KiboError("RATE_LIMITED", "penpot rate limit (paused)");
    deps.redactor.add(token);
    const res = await deps.fetch(
      `${instance}/api/rpc/command/${command}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        bearer: token,
        auth: PENPOT_AUTH,
      },
      penpotRules(new URL(instance)),
    );
    if (res.status === 429) pause.set(retryAfterSeconds(res.headers));
    return parseRemote("penpot", res, schema, redact);
  };
  const target = async (key: DesignFrameKey): Promise<Target> => {
    if (key.provider !== "penpot") throw new KiboError("INVALID_INPUT", "not a penpot frame");
    const instance = deps.instance();
    const token = instance === null ? null : await deps.token();
    if (instance === null || !token) throw new KiboError("NOT_CONNECTED", "penpot is not configured");
    if (new URL(key.instance).origin !== instance)
      throw new KiboError("PERMISSION_DENIED", "frame belongs to another penpot instance");
    return { key, instance, token };
  };
  const metadata = async ({ key, instance, token }: Target): Promise<FrameMeta> => {
    const body = { "file-id": key.fileId, "page-id": key.pageId, "object-id": key.boardId };
    const board = (await rpc("get-page", body, instance, token, Page)).objects[key.boardId];
    if (!board) throw new KiboError("REMOTE_NOT_FOUND", `penpot board ${key.boardId} not found`);
    return { name: board.name, width: board.width ?? null, height: board.height ?? null };
  };
  const thumbnailOf = async ({ key, instance, token }: Target): Promise<string | null> => {
    const map = await rpc(
      "get-file-object-thumbnails",
      { "file-id": key.fileId },
      instance,
      token,
      Thumbnails,
    );
    const suffix = `${key.pageId}/${key.boardId}`;
    return Object.entries(map).find(([k]) => k.includes(suffix))?.[1] ?? null;
  };
  const download = async (instance: string, mediaId: string) => {
    const url = `${instance}/assets/by-id/${encodeURIComponent(mediaId)}`;
    const image = await deps.fetch(url, { maxBytes: MAX_DESIGN_FRAME_BYTES }, penpotRules(new URL(instance)));
    if (image.status !== 200) throw remoteError("penpot", image.status, "", redact);
    if (image.truncated) throw new KiboError("TOO_LARGE", "frame image exceeds the limit");
    const mime = FrameMime.safeParse(sniffImage(image.body));
    if (!mime.success) throw new KiboError("REMOTE_REJECTED", "penpot thumbnail is not an image");
    return { body: image.body, mime: mime.data };
  };
  return {
    id: "penpot",
    connected: async () => deps.instance() !== null && (await deps.token()) !== null,
    version: async (key) => thumbnailOf(await target(key)),
    metadata: async (key) => metadata(await target(key)),
    async render(key): Promise<FrameRender> {
      const t = await target(key);
      const meta = await metadata(t);
      const mediaId = await thumbnailOf(t);
      if (mediaId === null)
        throw new KiboError("REMOTE_NOT_FOUND", "penpot has no thumbnail for this board yet");
      return { meta, ...(await download(t.instance, mediaId)), version: mediaId };
    },
    async profile(instance, token) {
      const profile = await rpc("get-profile", {}, instance, token, Profile);
      return { fullname: profile.fullname, email: profile.email ?? null };
    },
  };
}
